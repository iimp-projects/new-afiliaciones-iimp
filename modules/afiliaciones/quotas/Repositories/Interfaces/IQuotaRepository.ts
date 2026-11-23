import type { Prisma } from "@prisma/client";
import type { AssociateQuotaRecord, NormalizedQuota, QuotaSyncWriteResult } from "../../Models/QuotaModels";

export type QuotaTransaction = Prisma.TransactionClient;

export type ApplySuccessfulSyncInput = {
  personId: number | null;
  institutionalCode: string | null;
  quotas: readonly NormalizedQuota[];
  syncedAt: Date;
  actorUserId?: number | null;
  tx?: QuotaTransaction;
};

export interface IQuotaRepository {
  applySuccessfulSync(input: ApplySuccessfulSyncInput): Promise<QuotaSyncWriteResult>;
  findBySourceKey(sourceKey: string, tx?: QuotaTransaction): Promise<AssociateQuotaRecord | null>;
  listByPersonId(personId: number, tx?: QuotaTransaction): Promise<AssociateQuotaRecord[]>;
}
