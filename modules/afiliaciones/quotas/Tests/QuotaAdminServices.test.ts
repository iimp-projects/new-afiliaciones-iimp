import { describe, expect, it } from "vitest";
import type { QuotaAdminFilters, QuotaAssociateDetail, QuotaAssociateRow, QuotaHistoryRow, QuotaIncidenceRow, QuotaPaginated, QuotaSyncRunRow } from "../Models/QuotaAdmin";
import type { IQuotaAdminRepository, QuotaCategoryDistributionRow, QuotaCoverageRow, QuotaGroupRow, QuotaYearGroupRow } from "../Repositories/Interfaces/IQuotaAdminRepository";
import { QuotaDashboardService } from "../Services/QuotaDashboardService";
import { QuotaHistoryService } from "../Services/QuotaHistoryService";
import { QuotaIncidenceService } from "../Services/QuotaIncidenceService";
import { QuotaQueryService } from "../Services/QuotaQueryService";

const latestRun: QuotaSyncRunRow = {
  id: 5, status: "PARTIAL", scope: "FULL", startedAt: new Date("2026-11-18T20:00:00Z"), finishedAt: new Date("2026-11-18T20:44:00Z"),
  processedAssociates: 7, syncedAssociates: 3, noDataAssociates: 3, failedAssociates: 1, quotasInserted: 4, quotasUpdated: 0, quotasUnchanged: 0,
};
const coverage: QuotaCoverageRow[] = [
  { status: "SUCCEEDED", count: 3 }, { status: "NO_DATA", count: 1 }, { status: "NOT_FOUND", count: 2 }, { status: "FAILED", count: 1 },
];
const groups: QuotaGroupRow[] = [
  { concept: "CUOTA", currency: "S/", accountingStatus: "FACTURADO", count: 2, amount: "300.00" },
  { concept: "CUOTA", currency: "US$", accountingStatus: "PENDIENTE", count: 1, amount: "50.00" },
  { concept: "INSCRIPCION", currency: "S/", accountingStatus: "FACTURADO", count: 1, amount: "150.00" },
];
const yearGroups: QuotaYearGroupRow[] = [
  { year: 2026, concept: "CUOTA", currency: "S/", accountingStatus: "FACTURADO", count: 2, amount: "300.00" },
  { year: 2026, concept: "CUOTA", currency: "US$", accountingStatus: "PENDIENTE", count: 1, amount: "50.00" },
];
const category: QuotaCategoryDistributionRow[] = [{ categoryCode: "A", categoryName: "Activo", associates: 3, records: 4 }];

const associateRow = (overrides: Partial<QuotaAssociateRow> = {}): QuotaAssociateRow => ({
  personId: 1, institutionalCode: "000123", fullName: "Persona Uno", documentType: "DNI", documentNumber: "00123456",
  categoryCode: "A", categoryName: "Activo", membershipStatus: "ACTIVE", coverageStatus: "SUCCEEDED", financialStatus: "WITH_INFO",
  errorCode: null, quotaCount: 2, facturadoCount: 1, pendienteCount: 1, facturadoPen: "150.00", facturadoUsd: "0.00",
  pendientePen: "0.00", pendienteUsd: "50.00", pendingYears: [2026], nextPaymentYear: null, lastSync: new Date("2026-11-18T20:44:00Z"), ...overrides,
});

const historyRow = (overrides: Partial<QuotaHistoryRow> = {}): QuotaHistoryRow => ({
  id: 10, personId: 1, institutionalCode: "000123", personName: "Persona Uno", documentType: "DNI", documentNumber: "00123456",
  categoryCode: "A", categoryName: "Activo", concept: "CUOTA", quotaNumber: 1, year: 2026, currency: "S/", amount: "150.00",
  accountingStatus: "PENDIENTE", paidAt: null, periodStart: "2026-01-01", periodEnd: "2026-12-31", receiptSerie: null, receiptNumber: null,
  provider: "SIE", lastSeenAt: new Date("2026-11-18T20:44:00Z"), isPresentInLastSuccessfulSync: true, ...overrides,
});

const incidenceRow = (overrides: Partial<QuotaIncidenceRow> = {}): QuotaIncidenceRow => ({
  itemId: 1, personId: 1, institutionalCode: "000123", status: "FAILED", errorCode: "INVALID_YEAR", attempts: 1,
  categoryCode: "A", startedAt: new Date("2026-11-18T20:00:00Z"), finishedAt: new Date("2026-11-18T20:01:00Z"), resolved: false, ...overrides,
});

class FakeRepository implements IQuotaAdminRepository {
  async getLatestFullRun(): Promise<QuotaSyncRunRow | null> { return latestRun; }
  async getCoverage(): Promise<QuotaCoverageRow[]> { return coverage; }
  async getQuotaGroups(): Promise<QuotaGroupRow[]> { return groups; }
  async getYearGroups(): Promise<QuotaYearGroupRow[]> { return yearGroups; }
  async getCategoryDistribution(): Promise<QuotaCategoryDistributionRow[]> { return category; }
  async countUniverse(): Promise<number> { return 7; }
  async countAssociatesWithInfo(): Promise<number> { return 4; }
  async countAssociatesWithPending(): Promise<number> { return 2; }
  async countIncidences(): Promise<number> { return 1; }
  async countResolvedIncidences(): Promise<number> { return 1; }
  async listAssociates(): Promise<QuotaPaginated<QuotaAssociateRow>> { return { data: [associateRow()], meta: { page: 1, pageSize: 25, total: 1, totalPages: 1 } }; }
  async getAssociateDetail(): Promise<QuotaAssociateDetail | null> { return null; }
  async listHistory(): Promise<QuotaPaginated<QuotaHistoryRow>> { return { data: [historyRow()], meta: { page: 1, pageSize: 25, total: 1, totalPages: 1 } }; }
  async listIncidences(): Promise<QuotaPaginated<QuotaIncidenceRow>> { return { data: [incidenceRow()], meta: { page: 1, pageSize: 25, total: 1, totalPages: 1 } }; }
  async listSyncRuns(): Promise<QuotaPaginated<QuotaSyncRunRow>> { return { data: [latestRun], meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 } }; }
  async getSyncRun(): Promise<QuotaSyncRunRow | null> { return latestRun; }
  async listSyncRunItems(): Promise<QuotaPaginated<QuotaIncidenceRow>> { return { data: [], meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 } }; }
}

const filters: QuotaAdminFilters = { page: 1, pageSize: 25, concept: "CUOTA", sort: "name", direction: "asc" };

describe("quota admin services", () => {
  it("resume el universo y separa monedas y conceptos", async () => {
    const summary = await new QuotaDashboardService(new FakeRepository()).getSummary();
    expect(summary.universe).toEqual({ total: 7, withFinancialInfo: 4, withPending: 2, withoutPending: 2, noInfo: 1, notFound: 2, failed: 1, withIncidences: 1 });
    expect(summary.records).toEqual({ total: 4, quotas: 3, inscriptions: 1 });
    expect(summary.cuota.facturadoByCurrency).toEqual([{ currency: "S/", count: 2, amount: "300.00" }]);
    expect(summary.cuota.pendienteByCurrency).toEqual([{ currency: "US$", count: 1, amount: "50.00" }]);
    expect(summary).not.toHaveProperty("totalAmount");
  });

  it("enmascara documentos cuando el usuario no tiene permiso", async () => {
    const page = await new QuotaQueryService(new FakeRepository()).listAssociates(filters, false);
    expect(page.data[0].documentNumber).toBe("****56");
    const full = await new QuotaQueryService(new FakeRepository()).listAssociates(filters, true);
    expect(full.data[0].documentNumber).toBe("00123456");
  });

  it("enmascara documentos en el histórico", async () => {
    const page = await new QuotaHistoryService(new FakeRepository()).list(filters, false);
    expect(page.data[0].documentNumber).toBe("****56");
  });

  it("reporta incidencias vigentes y resueltas por separado", async () => {
    const page = await new QuotaIncidenceService(new FakeRepository()).list({ ...filters, includeResolved: true });
    expect(page.data[0].status).toBe("FAILED");
    expect(page.resolvedCount).toBe(1);
  });
});
