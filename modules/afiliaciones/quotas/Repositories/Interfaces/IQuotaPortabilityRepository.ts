import type { QuotaTransaction } from "./IQuotaRepository";
import type { AssociateQuotaRecord } from "../../Models/QuotaModels";
import type { PortableQuotaRecord } from "../../Models/QuotaPortability";

export type PortableUpsertResult = "INSERTED" | "UPDATED" | "UNCHANGED" | "SKIPPED_NEWER";

export interface IQuotaPortabilityRepository {
  listAll(): Promise<AssociateQuotaRecord[]>;
  findPersonIdsByInstitutionalCodes(codes: readonly string[]): Promise<Map<string, number>>;
  upsertPortable(record: PortableQuotaRecord, personId: number | null, force: boolean, tx?: QuotaTransaction): Promise<PortableUpsertResult>;
}
