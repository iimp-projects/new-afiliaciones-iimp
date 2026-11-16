export const RULE_CODES = ["R01", "R02", "R03", "R04", "R05", "R06", "R07", "R08"] as const;

export type RuleCode = (typeof RULE_CODES)[number];

export type RuleStatus = "PASS" | "FAIL" | "UNKNOWN" | "NOT_APPLICABLE";

export type PrevalidationResultStatus = "PREVALIDATED" | "OBSERVED" | "NEEDS_REVIEW";

export type PrevalidationUiStatus = PrevalidationResultStatus | "PROCESSING" | "TECHNICAL_ERROR";

export interface RuleEvaluationDTO {
  code: RuleCode;
  label: string;
  status: RuleStatus;
  message: string;
  evidence?: string;
}

export interface DocumentExtractionSummaryDTO {
  tipoDocumento: string;
  universidad: string | null;
  carrera: string | null;
  cicloAcademico: string | null;
  periodoAcademico: string | null;
}

export interface DocumentPrevalidationResponse {
  status: PrevalidationUiStatus;
  message: string;
  result: PrevalidationResultStatus | null;
  rules: RuleEvaluationDTO[];
  warnings: string[];
  extraction: DocumentExtractionSummaryDTO | null;
  file: {
    url: string;
    name: string;
    type: string;
    sizeBytes: number;
  };
  analyzedAt: string | null;
  durationMs: number;
  cacheHit: boolean;
}

export interface DocumentPrevalidationAdminDTO {
  id: string;
  fileUrl: string;
  fileName: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "TECHNICAL_ERROR";
  result: PrevalidationResultStatus | null;
  extraction: DocumentExtractionSummaryDTO | null;
  rules: RuleEvaluationDTO[];
  warnings: string[];
  modelUsed: string | null;
  modelVersion: string | null;
  rulesVersion: string;
  promptVersion: string;
  extractionSchemaVersion: string;
  durationMs: number | null;
  cacheHit: boolean;
  errorCode: string | null;
  analyzedAt: string | null;
  createdAt: string;
}

export interface DocumentPrevalidationConfigResponse {
  enabled: boolean;
}

export const DOCUMENT_TYPE_LABELS: Readonly<Record<string, string>> = {
  constancia_estudios: "Constancia de estudios",
  constancia_matricula: "Constancia de matrícula",
  ficha_matricula: "Ficha de matrícula",
  carnet_universitario: "Carné universitario",
  documento_identidad: "Documento de identidad",
  otro: "Otro documento",
  desconocido: "Documento no identificado",
};

export const RULE_STATUS_LABELS: Readonly<Record<RuleStatus, string>> = {
  PASS: "Cumple",
  FAIL: "No cumple",
  UNKNOWN: "Por verificar",
  NOT_APPLICABLE: "No aplica",
};
