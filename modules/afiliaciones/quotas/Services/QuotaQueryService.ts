import type { QuotaAdminFilters, QuotaAssociateDetail, QuotaPaginated, QuotaAssociateRow } from "../Models/QuotaAdmin";
import type { IQuotaAdminRepository } from "../Repositories/Interfaces/IQuotaAdminRepository";

export function maskDocumentNumber(value: string | null): string | null {
  if (!value) return null;
  if (value.length <= 2) return "****";
  return `****${value.slice(-2)}`;
}

export class QuotaQueryService {
  constructor(private readonly repository: IQuotaAdminRepository) {}

  async listAssociates(filters: QuotaAdminFilters, canViewDocument: boolean): Promise<QuotaPaginated<QuotaAssociateRow>> {
    const page = await this.repository.listAssociates(filters);
    return { ...page, data: page.data.map((row) => ({ ...row, documentNumber: canViewDocument ? row.documentNumber : maskDocumentNumber(row.documentNumber) })) };
  }

  async getAssociateDetail(personId: number, canViewDocument: boolean): Promise<QuotaAssociateDetail | null> {
    const detail = await this.repository.getAssociateDetail(personId);
    if (!detail) return null;
    return canViewDocument ? detail : { ...detail, identity: { ...detail.identity, documentNumber: maskDocumentNumber(detail.identity.documentNumber) } };
  }
}
