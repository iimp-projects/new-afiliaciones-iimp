import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { NiubizSessionDiagnostic } from "../../DTOs/Niubiz/NiubizSessionDiagnostic.dto";
import { isCertPauseEnabled, redactSessionValue } from "./NiubizSessionDiagnostics";

/**
 * Persistencia TEMPORAL de evidencias de certificación Niubiz (LOCAL-only).
 *
 * Solo escribe en disco cuando `isCertPauseEnabled()` es true (desarrollo local +
 * credenciales TEST + flag opt-in). Nunca se invoca desde QA/PROD.
 *
 * Los archivos se guardan en `docs/niubiz-certificacion/local/` y conservan la
 * estructura y los nombres de campo originales, con los secretos redactados.
 */
const EVIDENCE_DIR = path.join(process.cwd(), "docs", "niubiz-certificacion", "local");

function sanitizeCorrelationId(correlationId: string): string {
  return correlationId.replace(/[^a-zA-Z0-9_-]/g, "");
}

export interface PersistedSessionEvidence {
  requestPath: string;
  responsePath: string;
}

/**
 * Reaplica la redacción completa por defensa en profundidad y devuelve el objeto
 * tal cual se persiste o se renderiza. Nunca incluye valores sensibles.
 */
export function redactDiagnostic(diagnostic: NiubizSessionDiagnostic): NiubizSessionDiagnostic {
  const request = {
    ...diagnostic.request,
    headers: redactSessionValue(diagnostic.request.headers) as Record<string, unknown>,
    body: redactSessionValue(diagnostic.request.body),
  };
  const response = {
    ...diagnostic.response,
    body: redactSessionValue(diagnostic.response.body),
  };

  return {
    ...diagnostic,
    request,
    response,
    redacted: { request, response },
  };
}

/**
 * Guarda el request y el response redactados como JSON en disco. Devuelve las
 * rutas absolutas de los dos archivos.
 */
export async function persistSessionEvidence(diagnostic: NiubizSessionDiagnostic): Promise<PersistedSessionEvidence> {
  if (!isCertPauseEnabled()) {
    throw new Error("NIUBIZ_CERT_PAUSE_AFTER_SESSION no está habilitado; no se persiste evidencia.");
  }

  const safe = sanitizeCorrelationId(diagnostic.correlationId);
  const redacted = redactDiagnostic(diagnostic);
  await mkdir(EVIDENCE_DIR, { recursive: true });

  const requestPath = path.join(EVIDENCE_DIR, `${safe}-request.json`);
  const responsePath = path.join(EVIDENCE_DIR, `${safe}-response.json`);

  await writeFile(
    requestPath,
    JSON.stringify({ correlationId: safe, capturedAt: redacted.capturedAt, kind: "request", ...redacted.redacted.request }, null, 2) + "\n",
    "utf8",
  );
  await writeFile(
    responsePath,
    JSON.stringify({ correlationId: safe, capturedAt: redacted.capturedAt, kind: "response", ...redacted.redacted.response }, null, 2) + "\n",
    "utf8",
  );

  return { requestPath, responsePath };
}
