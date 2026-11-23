import type { AssociateQuotaRecord, QuotaSyncItemRecord, QuotaSyncRunRecord } from "../Models/QuotaModels";

export type QuotaDTO = {
  id: number;
  personId: number | null;
  institutionalCode: string | null;
  concept: AssociateQuotaRecord["concept"];
  quotaNumber: number | null;
  year: number;
  currency: string;
  amount: string;
  accountingStatus: AssociateQuotaRecord["accountingStatus"];
  membershipType: string;
  paidAt: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  receiptSerie: string | null;
  receiptNumber: string | null;
  isPresentInLastSuccessfulSync: boolean;
  firstSeenAt: Date;
  lastSeenAt: Date;
};

export function toQuotaDTO(record: AssociateQuotaRecord): QuotaDTO {
  return {
    id: record.id,
    personId: record.personId,
    institutionalCode: record.institutionalCode,
    concept: record.concept,
    quotaNumber: record.quotaNumber,
    year: record.year,
    currency: record.currency,
    amount: record.amount,
    accountingStatus: record.accountingStatus,
    membershipType: record.membershipType,
    paidAt: record.paidAt,
    periodStart: record.periodStart,
    periodEnd: record.periodEnd,
    receiptSerie: record.receiptSerie,
    receiptNumber: record.receiptNumber,
    isPresentInLastSuccessfulSync: record.isPresentInLastSuccessfulSync,
    firstSeenAt: record.firstSeenAt,
    lastSeenAt: record.lastSeenAt,
  };
}

export type QuotaSyncRunDTO = Pick<
  QuotaSyncRunRecord,
  | "id"
  | "status"
  | "scope"
  | "requestedByUserId"
  | "startedAt"
  | "finishedAt"
  | "totalAssociates"
  | "processedAssociates"
  | "syncedAssociates"
  | "noDataAssociates"
  | "failedAssociates"
  | "quotasInserted"
  | "quotasUpdated"
  | "quotasUnchanged"
> & {
  /** Derivado: cuotas insertadas o actualizadas. Evita el nombre erróneo quotesUpserted. */
  quotasUpserted: number;
};

export function toQuotaSyncRunDTO(record: QuotaSyncRunRecord): QuotaSyncRunDTO {
  return {
    id: record.id,
    status: record.status,
    scope: record.scope,
    requestedByUserId: record.requestedByUserId,
    startedAt: record.startedAt,
    finishedAt: record.finishedAt,
    totalAssociates: record.totalAssociates,
    processedAssociates: record.processedAssociates,
    syncedAssociates: record.syncedAssociates,
    noDataAssociates: record.noDataAssociates,
    failedAssociates: record.failedAssociates,
    quotasInserted: record.quotasInserted,
    quotasUpdated: record.quotasUpdated,
    quotasUnchanged: record.quotasUnchanged,
    quotasUpserted: record.quotasInserted + record.quotasUpdated,
  };
}

export type QuotaSyncItemDTO = Pick<
  QuotaSyncItemRecord,
  | "id"
  | "syncRunId"
  | "personId"
  | "institutionalCode"
  | "status"
  | "attempts"
  | "quotasRecovered"
  | "recordsCreated"
  | "recordsUpdated"
  | "errorCode"
  | "startedAt"
  | "finishedAt"
>;

export function toQuotaSyncItemDTO(record: QuotaSyncItemRecord): QuotaSyncItemDTO {
  return {
    id: record.id,
    syncRunId: record.syncRunId,
    personId: record.personId,
    institutionalCode: record.institutionalCode,
    status: record.status,
    attempts: record.attempts,
    quotasRecovered: record.quotasRecovered,
    recordsCreated: record.recordsCreated,
    recordsUpdated: record.recordsUpdated,
    errorCode: record.errorCode,
    startedAt: record.startedAt,
    finishedAt: record.finishedAt,
  };
}
