import type { QuotaSyncRunCounters, QuotaSyncRunRecord } from "../../Models/QuotaModels";
import type { QuotaTransaction } from "./IQuotaRepository";
import type { QuotaSyncRunFinalization, QuotaSyncRunInput } from "../quotaRepositoryMappers";

export interface IQuotaSyncRepository {
  createRun(input: QuotaSyncRunInput, tx?: QuotaTransaction): Promise<QuotaSyncRunRecord>;
  markRunning(id: number, startedAt: Date, tx?: QuotaTransaction): Promise<QuotaSyncRunRecord>;
  updateProgress(id: number, counters: QuotaSyncRunCounters, checkpoint: unknown, tx?: QuotaTransaction): Promise<QuotaSyncRunRecord>;
  finalizeRun(id: number, finalization: QuotaSyncRunFinalization, tx?: QuotaTransaction): Promise<QuotaSyncRunRecord>;
  findById(id: number, tx?: QuotaTransaction): Promise<QuotaSyncRunRecord | null>;
  findRecent(limit: number, tx?: QuotaTransaction): Promise<QuotaSyncRunRecord[]>;
}
