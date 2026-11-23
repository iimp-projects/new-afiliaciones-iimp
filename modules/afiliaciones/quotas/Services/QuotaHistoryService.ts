import type { QuotaAdminFilters, QuotaHistoryRow, QuotaPaginated } from "../Models/QuotaAdmin";
import type { IQuotaAdminRepository } from "../Repositories/Interfaces/IQuotaAdminRepository";
import { maskDocumentNumber } from "./QuotaQueryService";

export class QuotaHistoryService {
  constructor(private readonly repository: IQuotaAdminRepository) {}

  async list(filters: QuotaAdminFilters, canViewDocument: boolean): Promise<QuotaPaginated<QuotaHistoryRow>> {
    const page = await this.repository.listHistory(filters);
    return { ...page, data: page.data.map((row) => ({ ...row, documentNumber: canViewDocument ? row.documentNumber : maskDocumentNumber(row.documentNumber) })) };
  }

  async listForExport(filters: QuotaAdminFilters, canViewDocument: boolean, maxRows = 50_000): Promise<QuotaPaginated<QuotaHistoryRow>> {
    return this.list({ ...filters, page: 1, pageSize: maxRows }, canViewDocument);
  }
}
