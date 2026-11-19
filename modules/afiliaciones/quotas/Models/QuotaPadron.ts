import type { SanitizedSieAssociate } from "@/modules/afiliaciones/associates-integration/Models/SieAssociateList";

export type QuotaPadronPage = {
  pagina: number;
  totalPaginas: number;
  totalRegistros: number;
  associates: SanitizedSieAssociate[];
};

export type QuotaPadronFetcher = (input: { pagina: number; tamanioPagina: number }) => Promise<QuotaPadronPage>;

export type QuotaPadronCheckpoint = {
  lastPage: number;
  totalPages: number;
  pageSize: number;
};

export type QuotaPadronReport = {
  pagesFetched: number;
  totalRecords: number;
  uniqueRecords: number;
  duplicates: number;
  byCategory: Record<string, number>;
  byDocumentType: Record<string, number>;
  validDocument: number;
  unsupportedDocument: number;
  missingDocument: number;
  linkedToPerson: number;
  unlinked: number;
  checkpoint: QuotaPadronCheckpoint;
};

export type QuotaPadronSelection = {
  records: SanitizedSieAssociate[];
  personByDocument: Map<string, number>;
  report: QuotaPadronReport;
};
