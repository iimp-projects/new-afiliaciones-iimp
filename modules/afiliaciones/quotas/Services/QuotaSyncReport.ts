import type { QuotaSyncItemStatus, QuotaSyncRunStatus, QuotaSyncScope } from "@prisma/client";
import type { NormalizedQuota, QuotaIngestionResult, QuotaSyncRunCounters } from "../Models/QuotaModels";

export type QuotaSyncReport = {
  mode: QuotaSyncScope;
  dryRun: boolean;
  runId: number | null;
  status: QuotaSyncRunStatus | "DRY_RUN";
  startedAt: Date;
  finishedAt: Date;
  durationMs: number;
  selected: number;
  processed: number;
  synced: number;
  noData: number;
  notFound: number;
  failed: number;
  ambiguous: number;
  blocked: number;
  retries: number;
  quotasRecovered: number;
  quotasInserted: number;
  quotasUpdated: number;
  quotasUnchanged: number;
  quotasAbsent: number;
  byYear: Record<string, number>;
  byCurrency: Record<string, number>;
  byAccountingStatus: Record<string, number>;
  errors: Record<string, number>;
  checkpoint: unknown;
};

export class QuotaSyncReportBuilder {
  private processed = 0;
  private synced = 0;
  private noData = 0;
  private notFound = 0;
  private failed = 0;
  private ambiguous = 0;
  private blocked = 0;
  private retries = 0;
  private quotasRecovered = 0;
  private quotasInserted = 0;
  private quotasUpdated = 0;
  private quotasUnchanged = 0;
  private quotasAbsent = 0;
  private readonly byYear: Record<string, number> = {};
  private readonly byCurrency: Record<string, number> = {};
  private readonly byAccountingStatus: Record<string, number> = {};
  private readonly errors: Record<string, number> = {};

  private selected: number;

  constructor(
    private readonly mode: QuotaSyncScope,
    private readonly dryRun: boolean,
    private readonly startedAt: Date,
    selected: number,
  ) {
    this.selected = selected;
  }

  replaceErrors(errors: Record<string, number>): void {
    for (const key of Object.keys(this.errors)) delete this.errors[key];
    Object.assign(this.errors, errors);
  }

  seedCounters(counters: QuotaSyncRunCounters, distributions?: { byYear?: Record<string, number>; byCurrency?: Record<string, number>; byAccountingStatus?: Record<string, number>; errors?: Record<string, number> }): void {
    this.selected = Math.max(this.selected, counters.totalAssociates);
    this.processed = counters.processedAssociates;
    this.synced = counters.syncedAssociates;
    this.noData = counters.noDataAssociates;
    this.failed = counters.failedAssociates;
    this.quotasInserted = counters.quotasInserted;
    this.quotasUpdated = counters.quotasUpdated;
    this.quotasUnchanged = counters.quotasUnchanged;
    this.quotasRecovered = counters.quotasInserted + counters.quotasUpdated + counters.quotasUnchanged;
    if (distributions?.byYear) Object.assign(this.byYear, distributions.byYear);
    if (distributions?.byCurrency) Object.assign(this.byCurrency, distributions.byCurrency);
    if (distributions?.byAccountingStatus) Object.assign(this.byAccountingStatus, distributions.byAccountingStatus);
    if (distributions?.errors) Object.assign(this.errors, distributions.errors);
  }

  recordIngestion(result: QuotaIngestionResult, queryRetries = 0): void {
    this.processed += 1;
    this.retries += queryRetries;
    this.quotasRecovered += result.quotasRecovered;
    this.quotasInserted += result.inserted;
    this.quotasUpdated += result.updated;
    this.quotasUnchanged += result.unchanged;
    this.quotasAbsent += result.quotasAbsent;
    this.recordStatus(result.status);
    if (result.item.errorCode) this.recordError(result.item.errorCode);
    if (result.item.errorCode === "AMBIGUOUS_QUOTA_IDENTITY") this.ambiguous += 1;
    this.recordDistributions(result.quotas);
  }

  recordDryRunResult(input: {
    status: QuotaSyncItemStatus;
    quotas: readonly NormalizedQuota[];
    inserted: number;
    updated: number;
    unchanged: number;
    absent: number;
    retries: number;
    errorCode?: string;
  }): void {
    this.processed += 1;
    this.retries += Math.max(0, input.retries);
    this.quotasRecovered += input.quotas.length;
    this.quotasInserted += input.inserted;
    this.quotasUpdated += input.updated;
    this.quotasUnchanged += input.unchanged;
    this.quotasAbsent += input.absent;
    this.recordStatus(input.status);
    if (input.errorCode) {
      this.recordError(input.errorCode);
      if (input.errorCode === "AMBIGUOUS_QUOTA_IDENTITY") this.ambiguous += 1;
    }
    this.recordDistributions(input.quotas);
  }

  recordStatus(status: QuotaSyncItemStatus): void {
    if (status === "SUCCEEDED") this.synced += 1;
    else if (status === "NO_DATA") this.noData += 1;
    else if (status === "NOT_FOUND") this.notFound += 1;
    else if (status === "FAILED") this.failed += 1;
  }

  recordError(code: string): void {
    this.errors[code] = (this.errors[code] ?? 0) + 1;
  }

  recordBlocked(): void {
    this.blocked += 1;
  }

  addRetries(count: number): void {
    this.retries += Math.max(0, count);
  }

  addAbsent(count: number): void {
    this.quotasAbsent += Math.max(0, count);
  }

  recordDistributions(quotas: readonly NormalizedQuota[]): void {
    for (const quota of quotas) {
      this.byYear[String(quota.year)] = (this.byYear[String(quota.year)] ?? 0) + 1;
      this.byCurrency[quota.currency] = (this.byCurrency[quota.currency] ?? 0) + 1;
      this.byAccountingStatus[quota.accountingStatus] = (this.byAccountingStatus[quota.accountingStatus] ?? 0) + 1;
    }
  }

  distributions(): { byYear: Record<string, number>; byCurrency: Record<string, number>; byAccountingStatus: Record<string, number>; errors: Record<string, number> } {
    return {
      byYear: { ...this.byYear },
      byCurrency: { ...this.byCurrency },
      byAccountingStatus: { ...this.byAccountingStatus },
      errors: { ...this.errors },
    };
  }

  counters(): QuotaSyncRunCounters {
    return {
      totalAssociates: this.selected,
      processedAssociates: this.selected > 0 ? Math.min(this.processed, this.selected) : this.processed,
      syncedAssociates: this.synced,
      noDataAssociates: this.noData + this.notFound,
      failedAssociates: this.failed,
      quotasInserted: this.quotasInserted,
      quotasUpdated: this.quotasUpdated,
      quotasUnchanged: this.quotasUnchanged,
    };
  }

  build(input: { runId: number | null; status: QuotaSyncRunStatus | "DRY_RUN"; finishedAt: Date; checkpoint?: unknown }): QuotaSyncReport {
    return {
      mode: this.mode,
      dryRun: this.dryRun,
      runId: input.runId,
      status: input.status,
      startedAt: this.startedAt,
      finishedAt: input.finishedAt,
      durationMs: Math.max(0, input.finishedAt.getTime() - this.startedAt.getTime()),
      selected: this.selected,
      processed: this.selected > 0 ? Math.min(this.processed, this.selected) : this.processed,
      synced: this.synced,
      noData: this.noData,
      notFound: this.notFound,
      failed: this.failed,
      ambiguous: this.ambiguous,
      blocked: this.blocked,
      retries: this.retries,
      quotasRecovered: this.quotasRecovered,
      quotasInserted: this.quotasInserted,
      quotasUpdated: this.quotasUpdated,
      quotasUnchanged: this.quotasUnchanged,
      quotasAbsent: this.quotasAbsent,
      byYear: this.byYear,
      byCurrency: this.byCurrency,
      byAccountingStatus: this.byAccountingStatus,
      errors: this.errors,
      checkpoint: input.checkpoint ?? null,
    };
  }
}
