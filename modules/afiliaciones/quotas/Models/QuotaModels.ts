import type {
  DocumentType,
  QuotaAccountingStatus,
  QuotaConcept,
  QuotaSyncItemStatus,
  QuotaSyncRunStatus,
  QuotaSyncScope,
} from "@prisma/client";
import type { SieAssociateState, SieAssociateStateQuota } from "@/modules/afiliaciones/associates-integration/Models/AssociateIntegration";

export type QuotaPersonIdentity = {
  personId: number | null;
  documentType: DocumentType;
  documentNumber: string;
  institutionalCode: string | null;
};

export type QuotaIdentity = {
  personIdentityHash: string;
  documentType: DocumentType;
  documentNumberHash: string;
  sourceKey: string;
};

export type NormalizedQuota = {
  provider: string;
  personIdentityHash: string;
  documentType: DocumentType;
  documentNumberHash: string;
  sourceKey: string;
  sourcePayloadHash: string;
  institutionalCode: string | null;
  concept: QuotaConcept;
  quotaNumber: number | null;
  year: number;
  currency: string;
  amount: string;
  accountingStatus: QuotaAccountingStatus;
  membershipType: string;
  paidAt: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  receiptSerie: string | null;
  receiptNumber: string | null;
};

export type AssociateQuotaRecord = {
  id: number;
  personId: number | null;
  institutionalCode: string | null;
  provider: string;
  documentType: DocumentType;
  documentNumberHash: string;
  sourceKey: string;
  sourcePayloadHash: string;
  concept: QuotaConcept;
  quotaNumber: number | null;
  year: number;
  currency: string;
  amount: string;
  accountingStatus: QuotaAccountingStatus;
  membershipType: string;
  paidAt: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  receiptSerie: string | null;
  receiptNumber: string | null;
  isPresentInLastSuccessfulSync: boolean;
  firstSeenAt: Date;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type QuotaUpsertAction = "INSERTED" | "UPDATED" | "UNCHANGED";
export type QuotaUpsertResult = { action: QuotaUpsertAction; quota: AssociateQuotaRecord };
export type QuotaSyncWriteResult = {
  inserted: number;
  updated: number;
  unchanged: number;
  markedNotPresent: number;
};

export type QuotaSyncRunRecord = {
  id: number;
  status: QuotaSyncRunStatus;
  scope: QuotaSyncScope;
  requestedByUserId: number | null;
  startedAt: Date;
  finishedAt: Date | null;
  totalAssociates: number;
  processedAssociates: number;
  syncedAssociates: number;
  noDataAssociates: number;
  failedAssociates: number;
  quotasInserted: number;
  quotasUpdated: number;
  quotasUnchanged: number;
  checkpoint: unknown;
  summary: unknown;
  createdAt: Date;
  updatedAt: Date;
};

export type QuotaSyncItemRecord = {
  id: number;
  syncRunId: number;
  personId: number | null;
  institutionalCode: string | null;
  identityHash: string;
  status: QuotaSyncItemStatus;
  attempts: number;
  quotasRecovered: number;
  recordsCreated: number;
  recordsUpdated: number;
  errorCode: string | null;
  startedAt: Date;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type QuotaSyncRunCounters = {
  totalAssociates: number;
  processedAssociates: number;
  syncedAssociates: number;
  noDataAssociates: number;
  failedAssociates: number;
  quotasInserted: number;
  quotasUpdated: number;
  quotasUnchanged: number;
};

export type QuotaIngestionInput = {
  syncRunId: number;
  personId: number | null;
  documentType: string;
  documentNumber: string;
  institutionalCode?: string | null;
  state: SieAssociateState;
};

export type QuotaIngestionResult = {
  item: QuotaSyncItemRecord;
  status: QuotaSyncItemStatus;
  quotasRecovered: number;
  inserted: number;
  updated: number;
  unchanged: number;
  quotasAbsent: number;
  quotas: NormalizedQuota[];
};

export type SieQuotaContract = SieAssociateStateQuota;
