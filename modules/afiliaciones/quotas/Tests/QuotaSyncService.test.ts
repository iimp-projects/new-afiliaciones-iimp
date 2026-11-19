import { describe, expect, it, vi } from "vitest";
import type { SieAssociateState } from "@/modules/afiliaciones/associates-integration/Models/AssociateIntegration";
import type { AssociateQuotaRecord, NormalizedQuota, QuotaSyncItemRecord, QuotaSyncRunRecord, QuotaSyncWriteResult } from "../Models/QuotaModels";
import type { QuotaUniverseCandidate, QuotaUniverseReport, QuotaUniverseSelection } from "../Models/QuotaUniverse";
import type { ApplySuccessfulSyncInput, IQuotaRepository } from "../Repositories/Interfaces/IQuotaRepository";
import type { IQuotaSyncItemRepository } from "../Repositories/Interfaces/IQuotaSyncItemRepository";
import type { IQuotaSyncRepository } from "../Repositories/Interfaces/IQuotaSyncRepository";
import type { QuotaSyncItemCompletion, QuotaSyncItemInput, QuotaSyncRunFinalization } from "../Repositories/quotaRepositoryMappers";
import { QuotaIdentityResolver } from "../Services/QuotaIdentityResolver";
import { QuotaIngestionService } from "../Services/QuotaIngestionService";
import type { IQuotaSyncLock } from "../Services/QuotaSyncLock";
import { QuotaSyncService } from "../Services/QuotaSyncService";
import type { QuotaSieQueryResult } from "../Services/QuotaSieClient";
import { quotaFixture } from "./quotaFixtures";

class FakeQuotaRepository implements IQuotaRepository {
  readonly records = new Map<string, AssociateQuotaRecord>();
  private nextId = 1;

  async applySuccessfulSync(input: ApplySuccessfulSyncInput): Promise<QuotaSyncWriteResult> {
    let inserted = 0;
    let updated = 0;
    let unchanged = 0;
    const seen = new Set<string>();
    for (const quota of input.quotas) {
      const existing = this.records.get(quota.sourceKey);
      if (!existing) {
        this.records.set(quota.sourceKey, this.toRecord(quota, input, this.nextId++));
        inserted += 1;
      } else {
        const action = existing.sourcePayloadHash === quota.sourcePayloadHash ? "UNCHANGED" : "UPDATED";
        this.records.set(quota.sourceKey, this.toRecord(quota, input, existing.id, existing.firstSeenAt));
        if (action === "UPDATED") updated += 1;
        else unchanged += 1;
      }
      seen.add(quota.sourceKey);
    }
    let markedNotPresent = 0;
    if (input.personId != null) {
      for (const record of this.records.values()) {
        if (record.personId === input.personId && !seen.has(record.sourceKey) && record.isPresentInLastSuccessfulSync) {
          record.isPresentInLastSuccessfulSync = false;
          markedNotPresent += 1;
        }
      }
    }
    return { inserted, updated, unchanged, markedNotPresent };
  }

  async findBySourceKey(sourceKey: string): Promise<AssociateQuotaRecord | null> {
    return this.records.get(sourceKey) ?? null;
  }

  async listByPersonId(personId: number): Promise<AssociateQuotaRecord[]> {
    return [...this.records.values()].filter((record) => record.personId === personId);
  }

  private toRecord(quota: NormalizedQuota, input: ApplySuccessfulSyncInput, id: number, firstSeenAt = input.syncedAt): AssociateQuotaRecord {
    return {
      id,
      personId: input.personId,
      institutionalCode: quota.institutionalCode ?? input.institutionalCode,
      provider: quota.provider,
      documentType: quota.documentType,
      documentNumberHash: quota.documentNumberHash,
      sourceKey: quota.sourceKey,
      sourcePayloadHash: quota.sourcePayloadHash,
      concept: quota.concept,
      quotaNumber: quota.quotaNumber,
      year: quota.year,
      currency: quota.currency,
      amount: quota.amount,
      accountingStatus: quota.accountingStatus,
      membershipType: quota.membershipType,
      paidAt: quota.paidAt,
      periodStart: quota.periodStart,
      periodEnd: quota.periodEnd,
      receiptSerie: quota.receiptSerie,
      receiptNumber: quota.receiptNumber,
      isPresentInLastSuccessfulSync: true,
      firstSeenAt,
      lastSeenAt: input.syncedAt,
      createdAt: firstSeenAt,
      updatedAt: input.syncedAt,
    };
  }
}

class FakeItemRepository implements IQuotaSyncItemRepository {
  readonly items = new Map<string, QuotaSyncItemRecord>();
  private nextId = 1;

  async createOrGet(input: QuotaSyncItemInput): Promise<QuotaSyncItemRecord> {
    const key = `${input.syncRunId}:${input.identityHash}`;
    const existing = this.items.get(key);
    if (existing) return existing;
    const now = new Date("2026-11-18T12:00:00.000Z");
    const record: QuotaSyncItemRecord = {
      id: this.nextId++,
      syncRunId: input.syncRunId,
      personId: input.personId,
      institutionalCode: input.institutionalCode,
      identityHash: input.identityHash,
      status: "PENDING",
      attempts: 0,
      quotasRecovered: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      errorCode: null,
      startedAt: now,
      finishedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.items.set(key, record);
    return record;
  }

  async markRunning(id: number, startedAt: Date): Promise<QuotaSyncItemRecord> {
    const record = this.byId(id);
    record.status = "RUNNING";
    record.startedAt = startedAt;
    record.attempts += 1;
    return record;
  }

  async finish(id: number, completion: QuotaSyncItemCompletion): Promise<QuotaSyncItemRecord> {
    const record = this.byId(id);
    record.status = completion.status;
    record.quotasRecovered = completion.quotasRecovered;
    record.recordsCreated = completion.recordsCreated;
    record.recordsUpdated = completion.recordsUpdated;
    record.errorCode = completion.errorCode ?? null;
    record.finishedAt = completion.finishedAt;
    return record;
  }

  async listByRun(syncRunId: number): Promise<QuotaSyncItemRecord[]> {
    return [...this.items.values()].filter((item) => item.syncRunId === syncRunId);
  }

  byId(id: number): QuotaSyncItemRecord {
    const record = [...this.items.values()].find((item) => item.id === id);
    if (!record) throw new Error("item not found");
    return record;
  }
}

class FakeRunRepository implements IQuotaSyncRepository {
  readonly runs = new Map<number, QuotaSyncRunRecord>();
  private nextId = 1;

  async createRun(input: { scope: QuotaSyncRunRecord["scope"]; requestedByUserId?: number | null }): Promise<QuotaSyncRunRecord> {
    const now = new Date("2026-11-18T12:00:00.000Z");
    const record: QuotaSyncRunRecord = {
      id: this.nextId++,
      status: "PENDING",
      scope: input.scope,
      requestedByUserId: input.requestedByUserId ?? null,
      startedAt: now,
      finishedAt: null,
      totalAssociates: 0,
      processedAssociates: 0,
      syncedAssociates: 0,
      noDataAssociates: 0,
      failedAssociates: 0,
      quotasInserted: 0,
      quotasUpdated: 0,
      quotasUnchanged: 0,
      checkpoint: null,
      summary: null,
      createdAt: now,
      updatedAt: now,
    };
    this.runs.set(record.id, record);
    return record;
  }

  async markRunning(id: number, startedAt: Date): Promise<QuotaSyncRunRecord> {
    const run = this.byId(id);
    run.status = "RUNNING";
    run.startedAt = startedAt;
    return run;
  }

  async updateProgress(id: number, counters: import("../Models/QuotaModels").QuotaSyncRunCounters, checkpoint: unknown): Promise<QuotaSyncRunRecord> {
    const run = this.byId(id);
    Object.assign(run, counters, { checkpoint });
    return run;
  }

  async finalizeRun(id: number, finalization: QuotaSyncRunFinalization): Promise<QuotaSyncRunRecord> {
    const run = this.byId(id);
    Object.assign(run, finalization.counters, {
      status: finalization.status,
      finishedAt: finalization.finishedAt,
      checkpoint: finalization.checkpoint ?? run.checkpoint,
      summary: finalization.summary ?? null,
    });
    return run;
  }

  async findById(id: number): Promise<QuotaSyncRunRecord | null> {
    return this.runs.get(id) ?? null;
  }

  async findRecent(limit: number): Promise<QuotaSyncRunRecord[]> {
    return [...this.runs.values()].slice(0, limit);
  }

  byId(id: number): QuotaSyncRunRecord {
    const run = this.runs.get(id);
    if (!run) throw new Error("run not found");
    return run;
  }
}

class FakeLock implements IQuotaSyncLock {
  fail = false;
  acquisitions = 0;
  async acquire(): Promise<() => Promise<void>> {
    if (this.fail) throw new Error("lock busy");
    this.acquisitions += 1;
    return async () => undefined;
  }
}

class FakeSie {
  readonly responses = new Map<string, QuotaSieQueryResult>();
  readonly calls: string[] = [];
  active = 0;
  maxActive = 0;
  delayMs = 0;

  async query(input: { numDocumento: string }): Promise<QuotaSieQueryResult> {
    this.calls.push(input.numDocumento);
    this.active += 1;
    this.maxActive = Math.max(this.maxActive, this.active);
    if (this.delayMs > 0) await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    this.active -= 1;
    return this.responses.get(input.numDocumento) ?? { kind: "FAILED", error: { code: "SIE_UNKNOWN", attempts: 1 }, attempts: 1, retries: 0 };
  }
}

const candidate = (personId: number, documentNumber: string, overrides: Partial<QuotaUniverseCandidate> = {}): QuotaUniverseCandidate => ({
  personId,
  documentType: "1",
  documentNumber,
  institutionalCode: "000123",
  category: "A",
  ...overrides,
});

const state = (cuotas: Extract<SieAssociateState, { status: true }>["cuotas"]): QuotaSieQueryResult => ({
  kind: "STATE",
  state: { status: true, cuotas },
  attempts: 1,
  retries: 0,
});

const failed = (retries = 2): QuotaSieQueryResult => ({
  kind: "FAILED",
  error: { code: "SIE_SERVER_ERROR", attempts: retries + 1, httpStatus: 503 },
  attempts: retries + 1,
  retries,
});

function setup(candidates: QuotaUniverseCandidate[]) {
  const quotas = new FakeQuotaRepository();
  const items = new FakeItemRepository();
  const runs = new FakeRunRepository();
  const lock = new FakeLock();
  const sie = new FakeSie();
  let tick = 0;
  const base = new Date("2026-11-18T12:00:00.000Z");
  const now = () => new Date(base.getTime() + tick++ * 1000);
  const universe = {
    resolve: async (options: { personIds?: readonly number[]; limit?: number; full?: boolean } = {}): Promise<QuotaUniverseSelection> => {
      let selected = candidates;
      if (options.personIds) selected = selected.filter((item) => item.personId != null && options.personIds!.includes(item.personId));
      if (!options.full && options.limit != null) selected = selected.slice(0, options.limit);
      const report: QuotaUniverseReport = { selected: selected.length, fromSieRecords: selected.length, fromApplications: 0, duplicates: 0, unsupportedDocument: 0, missingDocument: 0 };
      return { candidates: selected, report };
    },
    resolveByInstitutionalCodes: async (codes: readonly string[]): Promise<QuotaUniverseSelection> => {
      const selected = candidates.filter((item) => item.institutionalCode != null && codes.includes(item.institutionalCode));
      const report: QuotaUniverseReport = { selected: selected.length, fromSieRecords: selected.length, fromApplications: 0, duplicates: 0, unsupportedDocument: 0, missingDocument: 0 };
      return { candidates: selected, report };
    },
  };
  const ingestion = new QuotaIngestionService(quotas, items, undefined, undefined, now);
  const service = new QuotaSyncService(universe, sie, ingestion, quotas, runs, items, lock, now);
  return { service, quotas, items, runs, lock, sie };
}

const identityHash = (documentNumber: string) => new QuotaIdentityResolver().resolvePerson({ documentType: "1", documentNumber }).personIdentityHash;

describe("QuotaSyncService", () => {
  it("ejecuta dry-run de un asociado sin escribir en BD", async () => {
    const { service, quotas, items, runs, sie } = setup([candidate(1, "00123456")]);
    sie.responses.set("00123456", state([quotaFixture({ concepto: "INSCRIPCION", numero: null, anno: 2023 }), quotaFixture()]));
    const result = await service.run({ mode: "PERSON", personIds: [1], dryRun: true });
    expect(result.report).toMatchObject({ dryRun: true, status: "DRY_RUN", selected: 1, processed: 1, synced: 1, quotasRecovered: 2, quotasInserted: 2 });
    expect(quotas.records.size).toBe(0);
    expect(items.items.size).toBe(0);
    expect(runs.runs.size).toBe(0);
  });

  it("persiste cuotas y es idempotente en una segunda ejecución", async () => {
    const { service, quotas, items, runs, sie } = setup([candidate(1, "00123456")]);
    sie.responses.set("00123456", state([quotaFixture({ concepto: "INSCRIPCION", numero: null, anno: 2023 }), quotaFixture()]));
    const first = await service.run({ mode: "PERSON", personIds: [1], dryRun: false });
    expect(first.report).toMatchObject({ status: "SUCCEEDED", quotasInserted: 2, quotasUpdated: 0, quotasUnchanged: 0, runId: 1 });
    expect(quotas.records.size).toBe(2);
    expect(items.items.size).toBe(1);
    expect(runs.byId(1).status).toBe("SUCCEEDED");

    const second = await service.run({ mode: "PERSON", personIds: [1], dryRun: false });
    expect(second.report).toMatchObject({ status: "SUCCEEDED", quotasInserted: 0, quotasUpdated: 0, quotasUnchanged: 2 });
    expect(quotas.records.size).toBe(2);
  });

  it("respeta la concurrencia configurada", async () => {
    const candidates = Array.from({ length: 5 }, (_, index) => candidate(index + 1, `0000000${index + 1}`));
    const { service, sie } = setup(candidates);
    for (const item of candidates) sie.responses.set(item.documentNumber, state([quotaFixture()]));
    sie.delayMs = 5;
    const result = await service.run({ mode: "BATCH", limit: 5, dryRun: false, concurrency: 2 });
    expect(result.report.synced).toBe(5);
    expect(sie.maxActive).toBeLessThanOrEqual(2);
  });

  it("finaliza PARTIAL ante fallos parciales y registra reintentos", async () => {
    const { service, sie } = setup([candidate(1, "00123456"), candidate(2, "00123457")]);
    sie.responses.set("00123456", state([quotaFixture()]));
    sie.responses.set("00123457", failed());
    const result = await service.run({ mode: "BATCH", limit: 2, dryRun: false });
    expect(result.report).toMatchObject({ status: "PARTIAL", synced: 1, failed: 1, retries: 2 });
  });

  it("falla cerrado ante identidades ambiguas", async () => {
    const { service, quotas, sie } = setup([candidate(1, "00123456")]);
    sie.responses.set("00123456", state([quotaFixture(), quotaFixture()]));
    const result = await service.run({ mode: "PERSON", personIds: [1], dryRun: false });
    expect(result.report).toMatchObject({ status: "FAILED", ambiguous: 1, failed: 1 });
    expect(quotas.records.size).toBe(0);
  });

  it("separa monedas en el reporte", async () => {
    const { service, sie } = setup([candidate(1, "00123456"), candidate(2, "00123457")]);
    sie.responses.set("00123456", state([quotaFixture({ moneda: "S/", monto: 150 })]));
    sie.responses.set("00123457", state([quotaFixture({ moneda: "US$", monto: 50 })]));
    const result = await service.run({ mode: "BATCH", limit: 2, dryRun: true });
    expect(result.report.byCurrency).toEqual({ "S/": 1, "US$": 1 });
  });

  it("reanuda items sin personId usando el código institucional persistido", async () => {
    const candidateWithoutPerson = { ...candidate(1, "00123456"), personId: null };
    const { service, runs, items, quotas, sie } = setup([candidateWithoutPerson]);
    const run = await runs.createRun({ scope: "PERSON" });
    await runs.markRunning(run.id, new Date());
    await items.createOrGet({ syncRunId: run.id, personId: null, institutionalCode: "000123", identityHash: identityHash("00123456") });
    sie.responses.set("00123456", state([quotaFixture()]));

    const result = await service.run({ mode: "PERSON", resumeRunId: run.id });
    expect(result.report).toMatchObject({ processed: 1, synced: 1 });
    expect([...quotas.records.values()][0].personId).toBeNull();
  });

  it("reanuda solo items pendientes", async () => {
    const { service, runs, items, sie } = setup([candidate(1, "00123456"), candidate(2, "00123457")]);
    const run = await runs.createRun({ scope: "BATCH" });
    await runs.markRunning(run.id, new Date());
    const item = await items.createOrGet({ syncRunId: run.id, personId: 1, institutionalCode: "000123", identityHash: identityHash("00123456") });
    expect(item.status).toBe("PENDING");
    sie.responses.set("00123456", state([quotaFixture()]));

    const result = await service.run({ mode: "BATCH", resumeRunId: run.id });
    expect(result.report).toMatchObject({ processed: 1, synced: 1 });
    expect(sie.calls).toEqual(["00123456"]);
  });

  it("reintenta solo items fallidos", async () => {
    const { service, runs, items, sie } = setup([candidate(1, "00123456")]);
    const run = await runs.createRun({ scope: "PERSON" });
    const item = await items.createOrGet({ syncRunId: run.id, personId: 1, institutionalCode: "000123", identityHash: identityHash("00123456") });
    item.status = "FAILED";
    item.errorCode = "SIE_SERVER_ERROR";
    sie.responses.set("00123456", state([quotaFixture()]));

    const result = await service.run({ mode: "PERSON", retryFailedRunId: run.id });
    expect(result.report).toMatchObject({ processed: 1, synced: 1 });
    expect(items.items.get(`${run.id}:${identityHash("00123456")}`)?.status).toBe("SUCCEEDED");
  });

  it("reanudar una ejecución sin items pendientes no borra sus contadores", async () => {
    const { service, runs } = setup([]);
    const run = await runs.createRun({ scope: "BATCH" });
    Object.assign(run, {
      status: "SUCCEEDED",
      totalAssociates: 2,
      processedAssociates: 2,
      syncedAssociates: 2,
      quotasInserted: 3,
      finishedAt: new Date("2026-11-18T12:05:00.000Z"),
    });
    const result = await service.run({ mode: "BATCH", resumeRunId: run.id });
    expect(result.report).toMatchObject({ runId: run.id, status: "SUCCEEDED", processed: 2, synced: 2, quotasInserted: 3 });
    expect(runs.byId(run.id)).toMatchObject({ processedAssociates: 2, syncedAssociates: 2, quotasInserted: 3, status: "SUCCEEDED" });
  });

  it("reintenta solo los códigos de error indicados", async () => {
    const { service, runs, items, sie } = setup([candidate(1, "00123456"), candidate(2, "00123457")]);
    const run = await runs.createRun({ scope: "BATCH" });
    const retryable = await items.createOrGet({ syncRunId: run.id, personId: 1, institutionalCode: "000123", identityHash: identityHash("00123456") });
    const blocked = await items.createOrGet({ syncRunId: run.id, personId: 2, institutionalCode: "000123", identityHash: identityHash("00123457") });
    retryable.status = "FAILED";
    retryable.errorCode = "SIE_INVALID_RESPONSE";
    blocked.status = "FAILED";
    blocked.errorCode = "INVALID_YEAR";
    sie.responses.set("00123456", state([quotaFixture()]));
    sie.responses.set("00123457", state([quotaFixture()]));

    const result = await service.run({ mode: "BATCH", retryFailedRunId: run.id, errorCodes: ["SIE_INVALID_RESPONSE"] });
    expect(result.report).toMatchObject({ processed: 1, synced: 1 });
    expect(retryable.status).toBe("SUCCEEDED");
    expect(blocked.status).toBe("FAILED");
    expect(sie.calls).toEqual(["00123456"]);
  });

  it("no infla asociados procesados al reintentar y recalcula errores reales", async () => {
    const { service, runs, items, sie } = setup([candidate(1, "00123456"), candidate(2, "00123457")]);
    const run = await runs.createRun({ scope: "BATCH" });
    Object.assign(run, { totalAssociates: 2, processedAssociates: 2, failedAssociates: 2 });
    const retryable = await items.createOrGet({ syncRunId: run.id, personId: 1, institutionalCode: "000123", identityHash: identityHash("00123456") });
    const blocked = await items.createOrGet({ syncRunId: run.id, personId: 2, institutionalCode: "000123", identityHash: identityHash("00123457") });
    retryable.status = "FAILED";
    retryable.errorCode = "SIE_INVALID_RESPONSE";
    blocked.status = "FAILED";
    blocked.errorCode = "INVALID_YEAR";
    sie.responses.set("00123456", state([quotaFixture()]));

    const result = await service.run({ mode: "BATCH", retryFailedRunId: run.id, errorCodes: ["SIE_INVALID_RESPONSE"] });
    expect(result.report).toMatchObject({ processed: 2, synced: 1, failed: 1, errors: { INVALID_YEAR: 1 } });
    expect(runs.byId(run.id)).toMatchObject({ processedAssociates: 2, syncedAssociates: 1, failedAssociates: 1, status: "PARTIAL" });
  });

  it("bloquea ejecuciones simultáneas", async () => {
    const { service, lock } = setup([candidate(1, "00123456")]);
    lock.fail = true;
    await expect(service.run({ mode: "PERSON", personIds: [1], dryRun: false })).rejects.toThrow("lock busy");
  });

  it("guarda checkpoint tras procesar", async () => {
    const { service, runs, sie } = setup([candidate(1, "00123456")]);
    sie.responses.set("00123456", state([quotaFixture()]));
    const result = await service.run({ mode: "PERSON", personIds: [1], dryRun: false });
    expect(result.report.checkpoint).toMatchObject({ processed: 1 });
    expect(runs.byId(1).checkpoint).toMatchObject({ processed: 1 });
    expect(runs.byId(1).status).toBe("SUCCEEDED");
  });
});
