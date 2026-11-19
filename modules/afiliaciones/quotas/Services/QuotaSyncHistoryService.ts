import type { QuotaPaginated, QuotaSyncRunRow } from "../Models/QuotaAdmin";
import type { IQuotaAdminRepository } from "../Repositories/Interfaces/IQuotaAdminRepository";
import type { QuotaIncidenceRow } from "../Models/QuotaAdmin";

export class QuotaSyncHistoryService {
  constructor(private readonly repository: IQuotaAdminRepository) {}

  listRuns(page: number, pageSize: number): Promise<QuotaPaginated<QuotaSyncRunRow>> {
    return this.repository.listSyncRuns(page, pageSize);
  }

  getRun(runId: number): Promise<QuotaSyncRunRow | null> {
    return this.repository.getSyncRun(runId);
  }

  listRunItems(runId: number, page: number, pageSize: number): Promise<QuotaPaginated<QuotaIncidenceRow>> {
    return this.repository.listSyncRunItems(runId, page, pageSize);
  }
}
