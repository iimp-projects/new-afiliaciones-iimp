export interface NiubizSessionEvidence {
  request: {
    method: string;
    url: string;
    headers: Record<string, unknown>;
    body: unknown;
  };
  response: {
    httpStatus: number;
    body: unknown;
  };
}

export type NiubizStageName = "SECURITY" | "SESSION" | "CHECKOUT" | "AUTHORIZATION";
export type NiubizStageResult = "SUCCESS" | "FAILED" | "NOT_EXECUTED";

export interface NiubizStageTrace {
  stage: NiubizStageName;
  result: NiubizStageResult;
  /** HTTP status externo de la etapa, si la llamada alcanzó Niubiz. */
  httpStatus?: number;
  /** Código de error de Niubiz, si el proveedor lo devolvió. */
  errorCode?: string;
  /** Mensaje técnico redactado (sin secretos ni PII). */
  message?: string;
}

export interface NiubizSessionDiagnostic {
  correlationId: string;
  origin: "NIUBIZ_TEST_LOCAL";
  capturedAt: string;
  /** Trazabilidad por etapa (SECURITY, SESSION, CHECKOUT, AUTHORIZATION). */
  stages: NiubizStageTrace[];
  /** Vista en pantalla: JSON real con secretos/tokens redactados, MDD/dataMap visibles. */
  request: NiubizSessionEvidence["request"];
  response: NiubizSessionEvidence["response"];
  /** Versión redactada para exportar (copiar/PNG/guardar): sin PII ni identificadores sensibles. */
  redacted: NiubizSessionEvidence;
  verification: {
    mdd4: boolean;
    mdd32: boolean;
    mdd75: boolean;
    mdd77: boolean;
    mdd77Present: boolean;
    mdd77Note?: string;
    dataMapFields: string[];
    missingDataMapFields: string[];
  };
}
