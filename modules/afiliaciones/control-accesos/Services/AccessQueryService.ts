import { movementToDto, presenceToDto, searchRowToIdentity } from "../DTOs/access.dto";
import {
  prismaAccessRepository,
  type MovementFilters,
  type PrismaAccessRepository,
} from "../Repositories/PrismaAccessRepository";

export class AccessQueryService {
  public constructor(private readonly repo: PrismaAccessRepository = prismaAccessRepository) {}

  public async search(query: string, limit: number) {
    const rows = await this.repo.searchPersons(query, limit);
    return rows.map(searchRowToIdentity);
  }

  public async movements(filters: MovementFilters, page: number, pageSize: number) {
    const { total, rows } = await this.repo.listMovements(filters, page, pageSize);
    return { total, page, pageSize, items: rows.map(movementToDto) };
  }

  public async presence(filters: { siteId?: number }, page: number, pageSize: number) {
    const { total, rows } = await this.repo.listPresence(filters, page, pageSize);
    return { total, page, pageSize, items: rows.map(presenceToDto) };
  }

  public dashboard(siteId?: number) {
    return this.repo.dashboard(siteId);
  }

  public sites() {
    return this.repo.listSites();
  }

  public points(siteId?: number) {
    return this.repo.listPoints(siteId);
  }

  public policies() {
    return this.repo.listPolicies();
  }

  public operators(siteId?: number) {
    return this.repo.listOperatorAssignments(siteId);
  }
}

export const accessQueryService = new AccessQueryService();
