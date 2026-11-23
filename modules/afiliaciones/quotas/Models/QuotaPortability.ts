import type { QuotaAccountingStatus, QuotaConcept } from "@prisma/client";

export type PortableQuotaRecord = {
  sourceKey: string;
  institutionalCode: string | null;
  provider: string;
  documentType: string;
  documentNumberHash: string;
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
  sourcePayloadHash: string;
  firstSeenAt: string;
  lastSeenAt: string;
};

export type QuotaExportFile = {
  formatVersion: 1;
  generatedAt: string;
  sourceDatabase: string;
  recordCount: number;
  checksum: string;
  records: PortableQuotaRecord[];
};

export type QuotaImportPlan = {
  inserted: number;
  updated: number;
  unchanged: number;
  skippedNewer: number;
  errors: number;
};
