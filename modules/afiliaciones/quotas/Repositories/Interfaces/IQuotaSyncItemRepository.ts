import type { QuotaSyncItemRecord } from "../../Models/QuotaModels";
import type { QuotaTransaction } from "./IQuotaRepository";
import type { QuotaSyncItemCompletion, QuotaSyncItemInput } from "../quotaRepositoryMappers";

export interface IQuotaSyncItemRepository {
  createOrGet(input: QuotaSyncItemInput, tx?: QuotaTransaction): Promise<QuotaSyncItemRecord>;
  markRunning(id: number, startedAt: Date, tx?: QuotaTransaction): Promise<QuotaSyncItemRecord>;
  finish(id: number, completion: QuotaSyncItemCompletion, tx?: QuotaTransaction): Promise<QuotaSyncItemRecord>;
  listByRun(syncRunId: number, tx?: QuotaTransaction): Promise<QuotaSyncItemRecord[]>;
}
