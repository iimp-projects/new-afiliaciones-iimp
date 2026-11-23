import type { DocumentType } from "@prisma/client";

export type UniverseSieRecord = {
  personId: number | null;
  externalCode: string;
  sourceDocumentType: string | null;
  documentNumber: string | null;
  sourceType: string;
};

export type UniversePerson = {
  personId: number;
  documentType: DocumentType;
  documentNumber: string;
};

export interface IQuotaUniverseRepository {
  listSieRecords(): Promise<UniverseSieRecord[]>;
  listCompletedApplicationPersons(): Promise<UniversePerson[]>;
  findPersonsByIds(personIds: readonly number[]): Promise<UniversePerson[]>;
}
