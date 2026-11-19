import type { QuotaAccountingStatus, QuotaConcept, QuotaSyncItemStatus } from "@prisma/client";
import type {
  QuotaAdminFilters,
  QuotaAssociateDetail,
  QuotaAssociateRow,
  QuotaDashboardSummary,
  QuotaHistoryRow,
  QuotaIncidenceRow,
  QuotaPaginated,
  QuotaSyncRunRow,
} from "../../Models/QuotaAdmin";

export type QuotaGroupRow = {
  concept: QuotaConcept;
  currency: string;
  accountingStatus: QuotaAccountingStatus;
  count: number;
  amount: string;
};

export type QuotaYearGroupRow = {
  year: number;
  concept: QuotaConcept;
  currency: string;
  accountingStatus: QuotaAccountingStatus;
  count: number;
  amount: string;
};

export type QuotaCategoryDistributionRow = {
  categoryCode: string;
  categoryName: string;
  associates: number;
  records: number;
};

export type QuotaCoverageRow = { status: QuotaSyncItemStatus; count: number };

export interface IQuotaAdminRepository {
  getLatestFullRun(): Promise<QuotaSyncRunRow | null>;
  getCoverage(runId: number): Promise<QuotaCoverageRow[]>;
  getQuotaGroups(): Promise<QuotaGroupRow[]>;
  getYearGroups(): Promise<QuotaYearGroupRow[]>;
  getCategoryDistribution(): Promise<QuotaCategoryDistributionRow[]>;
  countUniverse(runId: number): Promise<number>;
  countAssociatesWithInfo(): Promise<number>;
  countAssociatesWithPending(concept: QuotaConcept): Promise<number>;
  countIncidences(runId: number): Promise<number>;
  countResolvedIncidences(runId: number): Promise<number>;
  listAssociates(filters: QuotaAdminFilters): Promise<QuotaPaginated<QuotaAssociateRow>>;
  getAssociateDetail(personId: number): Promise<QuotaAssociateDetail | null>;
  listHistory(filters: QuotaAdminFilters): Promise<QuotaPaginated<QuotaHistoryRow>>;
  listIncidences(filters: QuotaAdminFilters & { includeResolved?: boolean }): Promise<QuotaPaginated<QuotaIncidenceRow>>;
  listSyncRuns(page: number, pageSize: number): Promise<QuotaPaginated<QuotaSyncRunRow>>;
  getSyncRun(runId: number): Promise<QuotaSyncRunRow | null>;
  listSyncRunItems(runId: number, page: number, pageSize: number): Promise<QuotaPaginated<QuotaIncidenceRow>>;
}

export type { QuotaDashboardSummary };

