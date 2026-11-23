import { EndorsementHistoryRepository } from "../Repositories/EndorsementHistoryRepository";
import type { EndorsementHistoryFilters, EndorsementHistoryPage } from "../Models/MyEndorsement";

const EMPTY_METRICS = { total: 0, approved: 0, inProcess: 0 };

/**
 * Caso de uso "Mis avales": resuelve la persona del asociado autenticado y
 * devuelve únicamente sus propios avales. Nunca acepta identidad del cliente.
 */
export class EndorsementHistoryService {
  constructor(private readonly repository = new EndorsementHistoryRepository()) {}

  async getForUser(
    userId: number,
    filters: EndorsementHistoryFilters,
  ): Promise<EndorsementHistoryPage> {
    const personId = await this.repository.personIdForUser(userId);
    if (!personId) {
      return {
        items: [],
        metrics: { ...EMPTY_METRICS },
        page: filters.page,
        pageSize: filters.pageSize,
        totalItems: 0,
        totalPages: 0,
      };
    }

    const [list, metrics] = await Promise.all([
      this.repository.list(personId, filters),
      this.repository.metrics(personId),
    ]);

    return {
      items: list.items,
      metrics,
      page: filters.page,
      pageSize: filters.pageSize,
      totalItems: list.totalItems,
      totalPages: Math.ceil(list.totalItems / filters.pageSize),
    };
  }
}
