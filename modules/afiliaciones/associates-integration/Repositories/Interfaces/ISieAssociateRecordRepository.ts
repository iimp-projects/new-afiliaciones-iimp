import type { Prisma, SieLinkStatus } from "@prisma/client";

const RECORD_SELECT = {
  id: true,
  provider: true,
  externalCode: true,
  sourceDocumentType: true,
  documentNumber: true,
  sourceType: true,
  sourceDescription: true,
  personId: true,
  categoryId: true,
  linkStatus: true,
  lastSyncedAt: true,
} as const;

export type SieAssociateRecordView = Prisma.SieAssociateRecordGetPayload<{ select: typeof RECORD_SELECT }>;

export type SieAssociateRecordInput = {
  provider: string;
  externalCode: string;
  sourceDocumentType?: string | null;
  documentNumber?: string | null;
  sourceType: string;
  sourceDescription?: string | null;
  categoryId?: number | null;
  personId?: number | null;
  linkStatus?: SieLinkStatus;
};

export interface ISieAssociateRecordRepository {
  findByProviderAndExternalCode(provider: string, externalCode: string): Promise<SieAssociateRecordView | null>;
  findByPersonId(personId: number): Promise<SieAssociateRecordView[]>;
  upsertExternalRecord(input: SieAssociateRecordInput): Promise<SieAssociateRecordView>;
  linkToPerson(recordId: number, personId: number): Promise<SieAssociateRecordView>;
  markConflict(recordId: number): Promise<SieAssociateRecordView>;
  listUnlinked(): Promise<SieAssociateRecordView[]>;
}
