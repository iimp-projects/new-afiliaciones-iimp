import type { QuotaAccountingStatus, QuotaConcept, QuotaSyncItemStatus, QuotaSyncRunStatus, QuotaSyncScope } from "@prisma/client";

export type QuotaFinancialStatus = "WITH_INFO" | "NO_INFO" | "NOT_FOUND" | "FAILED" | "WITH_INCIDENCES";
export type QuotaSortField = "name" | "institutionalCode" | "pendingPen" | "pendingUsd" | "pendingCount" | "lastSync";
export type SortDirection = "asc" | "desc";

export type QuotaAdminFilters = {
  search?: string;
  year?: number;
  yearFrom?: number;
  yearTo?: number;
  category?: string;
  membershipStatus?: string;
  accountingStatus?: QuotaAccountingStatus;
  financialStatus?: QuotaFinancialStatus;
  currency?: string;
  concept?: QuotaConcept;
  pendingMin?: string;
  pendingMax?: string;
  hasIncidences?: boolean;
  incidenceStatus?: QuotaSyncItemStatus;
  resolvedOnly?: boolean;
  errorCode?: string;
  personId?: number;
  includeAbsent?: boolean;
  sort?: QuotaSortField;
  direction?: SortDirection;
  page: number;
  pageSize: number;
};

export type QuotaPageMeta = { page: number; pageSize: number; total: number; totalPages: number };
export type QuotaPaginated<T> = { data: T[]; meta: QuotaPageMeta };

export type QuotaCurrencyTotal = { currency: string; count: number; amount: string };
export type QuotaConceptTotal = {
  concept: QuotaConcept;
  count: number;
  facturadoCount: number;
  pendienteCount: number;
  facturadoByCurrency: QuotaCurrencyTotal[];
  pendienteByCurrency: QuotaCurrencyTotal[];
};

export type QuotaDashboardSummary = {
  universe: {
    total: number;
    withFinancialInfo: number;
    withPending: number;
    withoutPending: number;
    noInfo: number;
    notFound: number;
    failed: number;
    withIncidences: number;
  };
  records: { total: number; quotas: number; inscriptions: number };
  cuota: QuotaConceptTotal;
  inscripcion: QuotaConceptTotal;
  byYear: Array<{ year: number; concept: QuotaConcept; currency: string; accountingStatus: QuotaAccountingStatus; count: number; amount: string }>;
  byCategory: Array<{ categoryCode: string; categoryName: string; associates: number; records: number }>;
  coverage: Array<{ status: QuotaSyncItemStatus; count: number }>;
  lastSync: {
    id: number;
    status: QuotaSyncRunStatus;
    scope: QuotaSyncScope;
    startedAt: Date;
    finishedAt: Date | null;
    processedAssociates: number;
    syncedAssociates: number;
    noDataAssociates: number;
    failedAssociates: number;
  } | null;
};

export type QuotaAssociateRow = {
  personId: number;
  institutionalCode: string | null;
  fullName: string;
  documentType: string;
  documentNumber: string | null;
  categoryCode: string | null;
  categoryName: string | null;
  membershipStatus: string | null;
  coverageStatus: QuotaSyncItemStatus;
  financialStatus: QuotaFinancialStatus;
  errorCode: string | null;
  quotaCount: number;
  facturadoCount: number;
  pendienteCount: number;
  facturadoPen: string;
  facturadoUsd: string;
  pendientePen: string;
  pendienteUsd: string;
  pendingYears: number[];
  nextPaymentYear: number | null;
  lastSync: Date | null;
};

export type QuotaHistoryRow = {
  id: number;
  personId: number | null;
  institutionalCode: string | null;
  personName: string | null;
  documentType: string | null;
  documentNumber: string | null;
  categoryCode: string | null;
  categoryName: string | null;
  concept: QuotaConcept;
  quotaNumber: number | null;
  year: number;
  currency: string;
  amount: string;
  accountingStatus: QuotaAccountingStatus;
  paidAt: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  receiptSerie: string | null;
  receiptNumber: string | null;
  provider: string;
  lastSeenAt: Date;
  isPresentInLastSuccessfulSync: boolean;
};

export type QuotaIncidenceRow = {
  itemId: number;
  personId: number | null;
  institutionalCode: string | null;
  status: QuotaSyncItemStatus;
  errorCode: string | null;
  attempts: number;
  categoryCode: string | null;
  startedAt: Date;
  finishedAt: Date | null;
  resolved: boolean;
};

export type QuotaAssociateDetail = {
  identity: {
    personId: number;
    fullName: string;
    documentType: string;
    documentNumber: string | null;
    institutionalCode: string | null;
    categoryCode: string | null;
    categoryName: string | null;
    membershipStatus: string | null;
  };
  synchronization: { status: QuotaSyncItemStatus | null; errorCode: string | null; attempts: number; lastSync: Date | null };
  summary: {
    totalsByCurrency: Array<{ currency: string; concept: QuotaConcept; count: number; amount: string }>;
    cuota: QuotaConceptTotal;
    inscripcion: QuotaConceptTotal;
    pendingYears: Array<{ concept: QuotaConcept; years: number[] }>;
    nextPayments: Array<{ year: number; currency: string; amount: string; quotaNumber: number | null }>;
  };
  history: Array<{
    concept: QuotaConcept;
    quotaNumber: number | null;
    year: number;
    currency: string;
    amount: string;
    accountingStatus: QuotaAccountingStatus;
    periodStart: string | null;
    periodEnd: string | null;
    paidAt: string | null;
    receiptSerie: string | null;
    receiptNumber: string | null;
    provider: string;
    lastSeenAt: Date;
    isPresentInLastSuccessfulSync: boolean;
  }>;
  incidences: Array<{ status: QuotaSyncItemStatus; errorCode: string | null; attempts: number; startedAt: Date; finishedAt: Date | null }>;
};

export type QuotaSyncRunRow = {
  id: number;
  status: QuotaSyncRunStatus;
  scope: QuotaSyncScope;
  startedAt: Date;
  finishedAt: Date | null;
  processedAssociates: number;
  syncedAssociates: number;
  noDataAssociates: number;
  failedAssociates: number;
  quotasInserted: number;
  quotasUpdated: number;
  quotasUnchanged: number;
};

