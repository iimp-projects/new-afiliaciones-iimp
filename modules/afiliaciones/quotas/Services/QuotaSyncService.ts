import type { QuotaSyncRunStatus, QuotaSyncScope } from "@prisma/client";
import { QuotaDomainError } from "../Models/QuotaErrors";
import type { QuotaIngestionResult, QuotaSyncRunCounters, QuotaSyncRunRecord } from "../Models/QuotaModels";
import type { QuotaUniverseReport, QuotaUniverseSelection } from "../Models/QuotaUniverse";
import type { IQuotaRepository } from "../Repositories/Interfaces/IQuotaRepository";
import type { IQuotaSyncItemRepository } from "../Repositories/Interfaces/IQuotaSyncItemRepository";
import type { IQuotaSyncRepository } from "../Repositories/Interfaces/IQuotaSyncRepository";
import type { QuotaIngestionService } from "./QuotaIngestionService";
import { QuotaIdentityResolver } from "./QuotaIdentityResolver";
import { QuotaNormalizer } from "./QuotaNormalizer";
import type { QuotaSieClient, QuotaSieQueryResult } from "./QuotaSieClient";
import { QuotaSyncReportBuilder, type QuotaSyncReport } from "./QuotaSyncReport";
import type { IQuotaSyncLock } from "./QuotaSyncLock";
import { planQuotaUpsert } from "./QuotaUpsertPlanner";
import type { QuotaUniverseService } from "./QuotaUniverseService";

export type QuotaSyncRequest = {
  mode: QuotaSyncScope;
  personIds?: readonly number[];
  limit?: number;
  offset?: number;
  full?: boolean;
  dryRun?: boolean;
  resumeRunId?: number;
  retryFailedRunId?: number;
  errorCodes?: readonly string[];
  concurrency?: number;
  actorUserId?: number | null;
};

export type QuotaSyncExecutionResult = {
  report: QuotaSyncReport;
  universe: QuotaUniverseReport | null;
};

type UniverseDependency = Pick<QuotaUniverseService, "resolve" | "resolveByInstitutionalCodes">;
type SieDependency = Pick<QuotaSieClient, "query">;
type IngestionDependency = Pick<QuotaIngestionService, "ingest" | "fail">;

type Candidate = QuotaUniverseSelection["candidates"][number];

export class QuotaSyncService {
  private readonly resolver = new QuotaIdentityResolver();
  private readonly normalizer = new QuotaNormalizer();

  constructor(
    private readonly universe: UniverseDependency,
    private readonly sie: SieDependency,
    private readonly ingestion: IngestionDependency,
    private readonly quotas: IQuotaRepository,
    private readonly runs: IQuotaSyncRepository,
    private readonly items: IQuotaSyncItemRepository,
    private readonly lock: IQuotaSyncLock,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async run(request: QuotaSyncRequest): Promise<QuotaSyncExecutionResult> {
    const explicitContinue = Boolean(request.resumeRunId || request.retryFailedRunId);
    const dryRun = explicitContinue ? false : request.dryRun ?? true;
    const release = dryRun ? null : await this.lock.acquire();
    try {
      if (request.resumeRunId) return await this.resume(request.resumeRunId, request);
      if (request.retryFailedRunId) return await this.retryFailed(request.retryFailedRunId, request);
      return await this.start(request, dryRun);
    } finally {
      if (release) await release();
    }
  }

  private async start(request: QuotaSyncRequest, dryRun: boolean): Promise<QuotaSyncExecutionResult> {
    const startedAt = this.now();
    const selection = await this.universe.resolve({ personIds: request.personIds, limit: request.limit, offset: request.offset, full: request.full });
    if (dryRun) return this.dryRun(selection, request, startedAt);

    if (selection.candidates.length === 0) {
      const builder = new QuotaSyncReportBuilder(request.mode, false, startedAt, 0);
      return { report: builder.build({ runId: null, status: "FAILED", finishedAt: this.now() }), universe: selection.report };
    }

    const run = await this.runs.createRun({ scope: request.mode, requestedByUserId: request.actorUserId ?? null });
    await this.runs.markRunning(run.id, startedAt);
    const builder = new QuotaSyncReportBuilder(request.mode, false, startedAt, selection.candidates.length);
    let checkpoint: unknown = null;

    try {
      await mapWithConcurrency(selection.candidates, this.concurrency(request), (candidate) => this.createItem(run.id, candidate));
      checkpoint = await this.processCandidates(run.id, selection.candidates, builder, this.concurrency(request), checkpoint);
    } catch (error) {
      builder.recordError(error instanceof QuotaDomainError ? error.code : "QUOTA_SYNC_ENGINE_FAILED");
    }

    const report = await this.finalize(run.id, builder, checkpoint);
    return { report, universe: selection.report };
  }

  private async resume(runId: number, request: QuotaSyncRequest): Promise<QuotaSyncExecutionResult> {
    const run = await this.requireRun(runId);
    const items = await this.items.listByRun(runId);
    const pending = items.filter((item) => item.status === "PENDING" || item.status === "RUNNING");
    return this.continueRun(run, pending, request, false);
  }

  private async retryFailed(runId: number, request: QuotaSyncRequest): Promise<QuotaSyncExecutionResult> {
    const run = await this.requireRun(runId);
    const items = await this.items.listByRun(runId);
    const allowedCodes = request.errorCodes?.length ? new Set(request.errorCodes) : null;
    const failed = items.filter((item) => item.status === "FAILED" && (!allowedCodes || allowedCodes.has(item.errorCode ?? "")));
    return this.continueRun(run, failed, request, true);
  }

  private async continueRun(
    run: QuotaSyncRunRecord,
    items: Awaited<ReturnType<IQuotaSyncItemRepository["listByRun"]>>,
    request: QuotaSyncRequest,
    retryingFailed: boolean,
  ): Promise<QuotaSyncExecutionResult> {
    const startedAt = this.now();
    if (items.length === 0) {
      const current = new QuotaSyncReportBuilder(run.scope, false, run.startedAt, run.totalAssociates);
      current.seedCounters(countersFromRun(run), distributionsFromSummary(run.summary));
      return {
        report: current.build({ runId: run.id, status: run.status, finishedAt: run.finishedAt ?? startedAt, checkpoint: run.checkpoint }),
        universe: null,
      };
    }

    const builder = new QuotaSyncReportBuilder(run.scope, false, startedAt, run.totalAssociates);
    const runId = run.id;
    let checkpoint: unknown = run.checkpoint;
    await this.runs.markRunning(runId, startedAt);

    const personIds = [...new Set(items.map((item) => item.personId).filter((id): id is number => id != null))];
    const institutionalCodes = [...new Set(items.map((item) => item.institutionalCode).filter((code): code is string => Boolean(code)))];
    const [personSelection, codeSelection] = await Promise.all([
      personIds.length ? this.universe.resolve({ personIds }) : Promise.resolve({ candidates: [] as Candidate[], report: null }),
      institutionalCodes.length ? this.universe.resolveByInstitutionalCodes(institutionalCodes) : Promise.resolve({ candidates: [] as Candidate[], report: null }),
    ]);
    const resolvedCandidates = [...personSelection.candidates, ...codeSelection.candidates];
    const byPersonId = new Map(resolvedCandidates.filter((candidate) => candidate.personId != null).map((candidate) => [candidate.personId as number, candidate]));
    const byCode = new Map(resolvedCandidates.filter((candidate) => candidate.institutionalCode).map((candidate) => [candidate.institutionalCode as string, candidate]));
    const byIdentityHash = new Map(resolvedCandidates.map((candidate) => [
      this.resolver.resolvePerson({ provider: "SIE", documentType: candidate.documentType, documentNumber: candidate.documentNumber }).personIdentityHash,
      candidate,
    ]));
    const selection = { candidates: resolvedCandidates, report: personSelection.report ?? codeSelection.report };
    const candidates: Candidate[] = [];
    let blocked = 0;

    for (const item of items) {
      let candidate = item.personId != null ? byPersonId.get(item.personId) : undefined;
      if (!candidate && item.institutionalCode) candidate = byCode.get(item.institutionalCode);
      if (!candidate && item.identityHash) candidate = byIdentityHash.get(item.identityHash);
      if (!candidate) {
        blocked += 1;
        continue;
      }
      candidates.push(candidate);
    }

    const seeded = countersFromRun(run);
    builder.seedCounters(
      retryingFailed
        ? {
            ...seeded,
            processedAssociates: Math.max(0, seeded.processedAssociates - candidates.length),
            failedAssociates: Math.max(0, seeded.failedAssociates - candidates.length),
          }
        : seeded,
      distributionsFromSummary(run.summary),
    );
    for (let index = 0; index < blocked; index += 1) {
      builder.recordBlocked();
      builder.recordError("MISSING_PERSON_FOR_RETRY");
    }

    if (candidates.length > 0) {
      try {
        checkpoint = await this.processCandidates(runId, candidates, builder, this.concurrency(request), checkpoint);
      } catch (error) {
        builder.recordError(error instanceof QuotaDomainError ? error.code : "QUOTA_SYNC_ENGINE_FAILED");
      }
    }

    const report = await this.finalize(runId, builder, checkpoint);
    return { report, universe: selection.report };
  }

  private async dryRun(selection: QuotaUniverseSelection, request: QuotaSyncRequest, startedAt: Date): Promise<QuotaSyncExecutionResult> {
    const builder = new QuotaSyncReportBuilder(request.mode, true, startedAt, selection.candidates.length);
    await mapWithConcurrency(selection.candidates, this.concurrency(request), async (candidate) => {
      const query = await this.sie.query({ tipoDocumento: candidate.documentType, numDocumento: candidate.documentNumber });
      if (query.kind === "FAILED") {
        builder.recordDryRunResult({ status: "FAILED", quotas: [], inserted: 0, updated: 0, unchanged: 0, absent: 0, retries: query.retries, errorCode: query.error.code });
        return;
      }
      if (query.kind === "NOT_FOUND") {
        builder.recordDryRunResult({ status: "NOT_FOUND", quotas: [], inserted: 0, updated: 0, unchanged: 0, absent: 0, retries: query.retries });
        return;
      }
      try {
        const existingForPerson = candidate.personId != null ? await this.quotas.listByPersonId(candidate.personId) : [];
        const legacyInscriptionYear = existingForPerson.find(
          (quota) => quota.concept === "INSCRIPCION" && quota.sourceKey.endsWith("|INSCRIPCION|INSCRIPCION"),
        )?.year ?? null;
        const quotas = this.normalizer.normalizeAll(query.state.status ? query.state.cuotas : [], {
          provider: "SIE",
          documentType: candidate.documentType,
          documentNumber: candidate.documentNumber,
          institutionalCode: candidate.institutionalCode,
        }, legacyInscriptionYear);
        let inserted = 0;
        let updated = 0;
        let unchanged = 0;
        for (const quota of quotas) {
          const existing = await this.quotas.findBySourceKey(quota.sourceKey);
          const action = planQuotaUpsert(existing, quota);
          if (action === "INSERTED") inserted += 1;
          else if (action === "UPDATED") updated += 1;
          else unchanged += 1;
        }
        let absent = 0;
        if (candidate.personId != null) {
          const seen = new Set(quotas.map((quota) => quota.sourceKey));
          absent = existingForPerson.filter((quota) => !seen.has(quota.sourceKey)).length;
        }
        builder.recordDryRunResult({ status: "SUCCEEDED", quotas, inserted, updated, unchanged, absent, retries: query.retries });
      } catch (error) {
        const code = error instanceof QuotaDomainError ? error.code : "QUOTA_NORMALIZATION_FAILED";
        builder.recordDryRunResult({ status: "FAILED", quotas: [], inserted: 0, updated: 0, unchanged: 0, absent: 0, retries: query.retries, errorCode: code });
      }
    });
    return { report: builder.build({ runId: null, status: "DRY_RUN", finishedAt: this.now() }), universe: selection.report };
  }

  private async processCandidates(runId: number, candidates: readonly Candidate[], builder: QuotaSyncReportBuilder, concurrency: number, initialCheckpoint: unknown): Promise<unknown> {
    let checkpoint = initialCheckpoint;
    await mapWithConcurrency(candidates, concurrency, async (candidate) => {
      const query = await this.sie.query({ tipoDocumento: candidate.documentType, numDocumento: candidate.documentNumber });
      let result: QuotaIngestionResult;
      try {
        result = await this.ingest(query, runId, candidate);
      } catch {
        builder.recordStatus("FAILED");
        builder.recordError("QUOTA_ITEM_PROCESSING_FAILED");
        return;
      }
      builder.recordIngestion(result, query.retries);
      checkpoint = { lastItemId: result.item.id, processed: builder.counters().processedAssociates };
      try {
        await this.runs.updateProgress(runId, builder.counters(), checkpoint);
      } catch {
        builder.recordError("QUOTA_PROGRESS_UPDATE_FAILED");
      }
    });
    return checkpoint;
  }

  private async ingest(query: QuotaSieQueryResult, runId: number, candidate: Candidate): Promise<QuotaIngestionResult> {
    const shared = {
      syncRunId: runId,
      personId: candidate.personId,
      documentType: candidate.documentType,
      documentNumber: candidate.documentNumber,
      institutionalCode: candidate.institutionalCode,
    };
    if (query.kind === "STATE") return this.ingestion.ingest({ ...shared, state: query.state });
    if (query.kind === "NOT_FOUND") return this.ingestion.ingest({ ...shared, state: { status: false, message: query.message } });
    return this.ingestion.fail(shared, query.error.code);
  }

  private async createItem(runId: number, candidate: Candidate): Promise<void> {
    const identity = this.resolver.resolvePerson({
      provider: "SIE",
      documentType: candidate.documentType,
      documentNumber: candidate.documentNumber,
    });
    await this.items.createOrGet({
      syncRunId: runId,
      personId: candidate.personId,
      institutionalCode: candidate.institutionalCode,
      identityHash: identity.personIdentityHash,
    });
  }

  private async finalize(runId: number, builder: QuotaSyncReportBuilder, checkpoint: unknown): Promise<QuotaSyncReport> {
    const allItems = await this.items.listByRun(runId);
    const errors: Record<string, number> = {};
    for (const item of allItems) {
      if (item.status !== "FAILED" || !item.errorCode) continue;
      errors[item.errorCode] = (errors[item.errorCode] ?? 0) + 1;
    }
    builder.replaceErrors(errors);
    const counters = builder.counters();
    const status = determineRunStatus(counters);
    const finishedAt = this.now();
    await this.runs.finalizeRun(runId, {
      status,
      counters,
      finishedAt,
      checkpoint: checkpoint == null ? undefined : (checkpoint as import("@prisma/client").Prisma.InputJsonValue),
      summary: { ...builder.distributions(), errors },
    });
    return builder.build({ runId, status, finishedAt, checkpoint });
  }

  private async requireRun(runId: number) {
    const run = await this.runs.findById(runId);
    if (!run) throw new Error(`No existe la ejecución de cuotas ${runId}.`);
    return run;
  }

  private concurrency(request: QuotaSyncRequest): number {
    const value = request.concurrency ?? 2;
    return Math.max(1, Math.min(10, Math.trunc(value)));
  }
}

function countersFromRun(run: QuotaSyncRunRecord): QuotaSyncRunCounters {
  return {
    totalAssociates: run.totalAssociates,
    processedAssociates: run.processedAssociates,
    syncedAssociates: run.syncedAssociates,
    noDataAssociates: run.noDataAssociates,
    failedAssociates: run.failedAssociates,
    quotasInserted: run.quotasInserted,
    quotasUpdated: run.quotasUpdated,
    quotasUnchanged: run.quotasUnchanged,
  };
}

function distributionsFromSummary(summary: unknown): { byYear?: Record<string, number>; byCurrency?: Record<string, number>; byAccountingStatus?: Record<string, number>; errors?: Record<string, number> } | undefined {
  if (typeof summary !== "object" || summary === null || Array.isArray(summary)) return undefined;
  const record = summary as Record<string, unknown>;
  return {
    byYear: numberRecord(record.byYear),
    byCurrency: numberRecord(record.byCurrency),
    byAccountingStatus: numberRecord(record.byAccountingStatus),
    errors: numberRecord(record.errors),
  };
}

function numberRecord(value: unknown): Record<string, number> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const result: Record<string, number> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "number" && Number.isFinite(item)) result[key] = item;
  }
  return result;
}

export function determineRunStatus(counters: QuotaSyncRunCounters): QuotaSyncRunStatus {
  if (counters.failedAssociates === 0) return "SUCCEEDED";
  if (counters.syncedAssociates + counters.noDataAssociates === 0) return "FAILED";
  return "PARTIAL";
}

async function mapWithConcurrency<T>(items: readonly T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  if (items.length === 0) return;
  let index = 0;
  const workers = Array.from({ length: Math.min(Math.max(1, limit), items.length) }, async () => {
    while (true) {
      const current = index;
      index += 1;
      if (current >= items.length) return;
      await worker(items[current]);
    }
  });
  await Promise.all(workers);
}

