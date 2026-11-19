import type { DocumentType } from "@prisma/client";

export type PadronDocument = {
  documentType: DocumentType;
  documentNumber: string;
};

export interface IQuotaPadronRepository {
  findPersonIdsByDocuments(documents: readonly PadronDocument[]): Promise<Map<string, number>>;
}
