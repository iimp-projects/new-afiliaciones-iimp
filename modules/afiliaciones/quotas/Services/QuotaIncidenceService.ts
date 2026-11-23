import type { QuotaAdminFilters, QuotaIncidenceRow, QuotaPaginated } from "../Models/QuotaAdmin";
import type { IQuotaAdminRepository } from "../Repositories/Interfaces/IQuotaAdminRepository";

export class QuotaIncidenceService {
  constructor(private readonly repository: IQuotaAdminRepository) {}

  async list(filters: QuotaAdminFilters & { includeResolved?: boolean }): Promise<QuotaPaginated<QuotaIncidenceRow> & { resolvedCount: number }> {
    const latest = await this.repository.getLatestFullRun();
    const [page, resolvedCount] = await Promise.all([
      this.repository.listIncidences(filters),
      latest ? this.repository.countResolvedIncidences(latest.id) : Promise.resolve(0),
    ]);
    return { ...page, resolvedCount };
  }

  async listForExport(filters: QuotaAdminFilters & { includeResolved?: boolean }, maxRows = 50_000) {
    return this.list({ ...filters, page: 1, pageSize: maxRows });
  }
}
