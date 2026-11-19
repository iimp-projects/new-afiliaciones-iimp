export type SieDocumentType = "1" | "4" | "7";

export type QuotaUniverseCandidate = {
  personId: number | null;
  documentType: SieDocumentType;
  documentNumber: string;
  institutionalCode: string | null;
  category: string | null;
};

export type QuotaUniverseReport = {
  selected: number;
  fromSieRecords: number;
  fromApplications: number;
  duplicates: number;
  unsupportedDocument: number;
  missingDocument: number;
};

export type QuotaUniverseSelection = {
  candidates: QuotaUniverseCandidate[];
  report: QuotaUniverseReport;
};
