import { describe, expect, it, vi } from "vitest";
import type { QuotaAdminFilters, QuotaAssociateDetail, QuotaAssociateRow, QuotaHistoryRow, QuotaIncidenceRow, QuotaPaginated, QuotaSyncRunRow } from "../Models/QuotaAdmin";
import type { IQuotaAdminRepository, QuotaCategoryDistributionRow, QuotaCoverageRow, QuotaGroupRow, QuotaYearGroupRow } from "../Repositories/Interfaces/IQuotaAdminRepository";
import { QuotaDashboardService } from "../Services/QuotaDashboardService";
import { QuotaExportService } from "../Services/QuotaExportService";
import { QuotaHistoryService } from "../Services/QuotaHistoryService";
import { QuotaIncidenceService } from "../Services/QuotaIncidenceService";
import { QuotaQueryService } from "../Services/QuotaQueryService";

const run: QuotaSyncRunRow = { id: 5, status: "PARTIAL", scope: "FULL", startedAt: new Date(), finishedAt: new Date(), processedAssociates: 1, syncedAssociates: 1, noDataAssociates: 0, failedAssociates: 0, quotasInserted: 1, quotasUpdated: 0, quotasUnchanged: 0 };
const groups: QuotaGroupRow[] = [{ concept: "CUOTA", currency: "S/", accountingStatus: "FACTURADO", count: 1, amount: "150.00" }];
const row: QuotaAssociateRow = { personId: 1, institutionalCode: "000123", fullName: "Persona", documentType: "DNI", documentNumber: "00123456", categoryCode: "A", categoryName: "Activo", membershipStatus: "ACTIVE", coverageStatus: "SUCCEEDED", financialStatus: "WITH_INFO", errorCode: null, quotaCount: 1, facturadoCount: 1, pendienteCount: 0, facturadoPen: "150.00", facturadoUsd: "0.00", pendientePen: "0.00", pendienteUsd: "0.00", pendingYears: [], nextPaymentYear: null, lastSync: new Date() };
const history: QuotaHistoryRow = { id: 1, personId: 1, institutionalCode: "000123", personName: "Persona", documentType: "DNI", documentNumber: "00123456", categoryCode: "A", categoryName: "Activo", concept: "CUOTA", quotaNumber: 1, year: 2026, currency: "S/", amount: "150.00", accountingStatus: "FACTURADO", paidAt: "2026-01-05", periodStart: "2026-01-01", periodEnd: "2026-12-31", receiptSerie: "F001", receiptNumber: "1", provider: "SIE", lastSeenAt: new Date(), isPresentInLastSuccessfulSync: true };

class FakeRepository implements IQuotaAdminRepository {
  async getLatestFullRun() { return run; }
  async getCoverage(): Promise<QuotaCoverageRow[]> { return [{ status: "SUCCEEDED", count: 1 }]; }
  async getQuotaGroups() { return groups; }
  async getYearGroups(): Promise<QuotaYearGroupRow[]> { return [{ year: 2026, concept: "CUOTA", currency: "S/", accountingStatus: "FACTURADO", count: 1, amount: "150.00" }]; }
  async getCategoryDistribution(): Promise<QuotaCategoryDistributionRow[]> { return []; }
  async countUniverse() { return 1; }
  async countAssociatesWithInfo() { return 1; }
  async countAssociatesWithPending() { return 0; }
  async countIncidences() { return 0; }
  async countResolvedIncidences() { return 0; }
  async listAssociates(): Promise<QuotaPaginated<QuotaAssociateRow>> { return { data: [row], meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 } }; }
  async getAssociateDetail(): Promise<QuotaAssociateDetail | null> { return null; }
  async listHistory(): Promise<QuotaPaginated<QuotaHistoryRow>> { return { data: [history], meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 } }; }
  async listIncidences(): Promise<QuotaPaginated<QuotaIncidenceRow>> { return { data: [], meta: { page: 1, pageSize: 100, total: 0, totalPages: 0 } }; }
  async listSyncRuns(): Promise<QuotaPaginated<QuotaSyncRunRow>> { return { data: [run], meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 } }; }
  async getSyncRun() { return run; }
  async listSyncRunItems(): Promise<QuotaPaginated<QuotaIncidenceRow>> { return { data: [], meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 } }; }
}

const filters: QuotaAdminFilters = { page: 1, pageSize: 100, concept: "CUOTA", sort: "name", direction: "asc" };

describe("QuotaExportService", () => {
  it("genera Excel de asociados y registra auditoría", async () => {
    const repository = new FakeRepository();
    const audit = vi.fn().mockResolvedValue(undefined);
    const service = new QuotaExportService(
      new QuotaDashboardService(repository), new QuotaQueryService(repository), new QuotaHistoryService(repository), new QuotaIncidenceService(repository), audit,
    );
    const result = await service.build({ type: "associates", filters, canViewDocument: true, actorUserId: 1 });
    expect(result.buffer.length).toBeGreaterThan(0);
    expect(result.rowCount).toBe(1);
    expect(result.filename).toMatch(/\.xlsx$/);
    expect(audit).toHaveBeenCalledOnce();
    expect(audit.mock.calls[0][0]).toMatchObject({ type: "associates", rowCount: 1, actorUserId: 1 });
  });

  it("genera resumen sin total multi-moneda", async () => {
    const repository = new FakeRepository();
    const service = new QuotaExportService(new QuotaDashboardService(repository), new QuotaQueryService(repository), new QuotaHistoryService(repository), new QuotaIncidenceService(repository), vi.fn().mockResolvedValue(undefined));
    const result = await service.build({ type: "summary", filters, canViewDocument: true, actorUserId: null });
    expect(result.buffer.length).toBeGreaterThan(0);
  });
});
