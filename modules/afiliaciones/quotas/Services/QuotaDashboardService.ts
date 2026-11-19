import type { QuotaDashboardSummary } from "../Models/QuotaAdmin";
import type { IQuotaAdminRepository } from "../Repositories/Interfaces/IQuotaAdminRepository";
import { buildConceptTotal } from "./quotaConceptTotal";

export class QuotaDashboardService {
  constructor(private readonly repository: IQuotaAdminRepository) {}

  async getSummary(): Promise<QuotaDashboardSummary> {
    const latest = await this.repository.getLatestFullRun();
    if (!latest) {
      const empty = { concept: "CUOTA" as const, count: 0, facturadoCount: 0, pendienteCount: 0, facturadoByCurrency: [], pendienteByCurrency: [] };
      return {
        universe: { total: 0, withFinancialInfo: 0, withPending: 0, withoutPending: 0, noInfo: 0, notFound: 0, failed: 0, withIncidences: 0 },
        records: { total: 0, quotas: 0, inscriptions: 0 },
        cuota: empty,
        inscripcion: { ...empty, concept: "INSCRIPCION" },
        byYear: [],
        byCategory: [],
        coverage: [],
        lastSync: null,
      };
    }

    const [coverage, groups, yearGroups, byCategory, universe, withFinancialInfo, withPending] = await Promise.all([
      this.repository.getCoverage(latest.id),
      this.repository.getQuotaGroups(),
      this.repository.getYearGroups(),
      this.repository.getCategoryDistribution(),
      this.repository.countUniverse(latest.id),
      this.repository.countAssociatesWithInfo(),
      this.repository.countAssociatesWithPending("CUOTA"),
    ]);
    const coverageMap = new Map(coverage.map((row) => [row.status, row.count]));
    const noInfo = coverageMap.get("NO_DATA") ?? 0;
    const notFound = coverageMap.get("NOT_FOUND") ?? 0;
    const failed = coverageMap.get("FAILED") ?? 0;
    const cuota = buildConceptTotal("CUOTA", groups);
    const inscripcion = buildConceptTotal("INSCRIPCION", groups);

    return {
      universe: {
        total: universe,
        withFinancialInfo,
        withPending,
        withoutPending: Math.max(0, withFinancialInfo - withPending),
        noInfo,
        notFound,
        failed,
        withIncidences: failed,
      },
      records: {
        total: groups.reduce((sum, group) => sum + group.count, 0),
        quotas: cuota.count,
        inscriptions: inscripcion.count,
      },
      cuota,
      inscripcion,
      byYear: yearGroups.map((group) => ({ year: group.year, concept: group.concept, currency: group.currency, accountingStatus: group.accountingStatus, count: group.count, amount: group.amount })),
      byCategory,
      coverage,
      lastSync: latest,
    };
  }
}
