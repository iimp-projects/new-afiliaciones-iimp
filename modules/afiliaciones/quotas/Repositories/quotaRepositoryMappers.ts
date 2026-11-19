import { Prisma } from "@prisma/client";
import type {
  AssociateQuota,
  QuotaSyncItem,
  QuotaSyncItemStatus,
  QuotaSyncRun,
  QuotaSyncRunStatus,
  QuotaSyncScope,
} from "@prisma/client";
import type {
  AssociateQuotaRecord,
  QuotaSyncItemRecord,
  QuotaSyncRunCounters,
  QuotaSyncRunRecord,
} from "../Models/QuotaModels";

export function toQuotaRecord(record: AssociateQuota): AssociateQuotaRecord {
  return {
    id: record.id,
    personId: record.personId,
    institutionalCode: record.institutionalCode,
    provider: record.provider,
    documentType: record.documentType,
    documentNumberHash: record.documentNumberHash,
    sourceKey: record.sourceKey,
    sourcePayloadHash: record.sourcePayloadHash,
    concept: record.concept,
    quotaNumber: record.quotaNumber,
    year: record.year,
    currency: record.currency,
    amount: record.amount.toFixed(2),
    accountingStatus: record.accountingStatus,
    membershipType: record.membershipType,
    paidAt: toIsoDate(record.paidAt),
    periodStart: toIsoDate(record.periodStart),
    periodEnd: toIsoDate(record.periodEnd),
    receiptSerie: record.receiptSerie,
    receiptNumber: record.receiptNumber,
    isPresentInLastSuccessfulSync: record.isPresentInLastSuccessfulSync,
    firstSeenAt: record.firstSeenAt,
    lastSeenAt: record.lastSeenAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function toQuotaSyncRunRecord(record: QuotaSyncRun): QuotaSyncRunRecord {
  return { ...record, checkpoint: record.checkpoint, summary: record.summary };
}

export function toQuotaSyncItemRecord(record: QuotaSyncItem): QuotaSyncItemRecord {
  return record;
}

export function toIsoDate(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

export function toDatabaseDate(value: string | null): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

export type QuotaSyncRunInput = {
  scope: QuotaSyncScope;
  requestedByUserId?: number | null;
};

export type QuotaSyncRunFinalization = {
  status: QuotaSyncRunStatus;
  counters: QuotaSyncRunCounters;
  finishedAt: Date;
  checkpoint?: Prisma.InputJsonValue | null;
  summary?: Prisma.InputJsonValue | null;
};

export type QuotaSyncItemInput = {
  syncRunId: number;
  personId: number | null;
  institutionalCode: string | null;
  identityHash: string;
};

export type QuotaSyncItemCompletion = {
  status: QuotaSyncItemStatus;
  quotasRecovered: number;
  recordsCreated: number;
  recordsUpdated: number;
  errorCode?: string | null;
  finishedAt: Date;
};

export function jsonValue(value: Prisma.InputJsonValue | null | undefined): Prisma.InputJsonValue | typeof Prisma.DbNull | undefined {
  if (value === undefined) return undefined;
  return value === null ? Prisma.DbNull : value;
}

