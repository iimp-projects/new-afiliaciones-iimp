import type { NiubizTestConfig } from "../../Config/PaymentConfig";
import type { NiubizSessionRequest } from "../../DTOs/Niubiz/NiubizSession.dto";
import type { NiubizSessionDiagnostic, NiubizStageTrace } from "../../DTOs/Niubiz/NiubizSessionDiagnostic.dto";

/**
 * Mecanismo TEMPORAL de diagnóstico de la sesión Niubiz para certificación.
 *
 * Propósito único: obtener, para una misma sesión real, el request y el response
 * redactados (sin Authorization, accessToken, sessionKey, datos personales ni
 * datos de tarjeta) y mostrarlos con método HTTP, endpoint Sandbox, código HTTP
 * y una referencia de correlación no sensible.
 *
 * Protecciones:
 * - Solo se activa con PAYMENT_ENVIRONMENT=TEST.
 * - Desactivado por defecto: exige NIUBIZ_TEST_SESSION_DIAGNOSTICS_ENABLED=true.
 * - Nunca emite valores completos de campos sensibles; solo "[REDACTED]".
 * - Solo usa console.info; no persiste nada en disco ni en base de datos.
 */
const REDACTED = "[REDACTED]";

export const CARDHOLDER_DATA_MAP_FIELDS = [
  "cardholderCity",
  "cardholderCountry",
  "cardholderAddress",
  "cardholderPostalCode",
  "cardholderState",
  "cardholderPhoneNumber",
] as const;

const SENSITIVE_KEYS = new Set([
  "authorization",
  "accesstoken",
  "sessionkey",
  "clientip",
  "email",
  "phone",
  "phonenumber",
  "documentnumber",
  "firstname",
  "lastname",
  "name",
  "mdd4",
  "mdd31",
  "mdd32",
  "mdd34",
  "cardholderaddress",
  "cardholdercity",
  "cardholderstate",
  "cardholderpostalcode",
  "cardholdercountry",
  "cardholderphonenumber",
]);

/**
 * Claves que se redactan incluso en la vista en pantalla: tokens y credenciales
 * de sesión. No aportan al objetivo de verificar los MDD; nunca se muestran.
 */
const SECRET_KEYS = new Set(["authorization", "accesstoken", "sessionkey"]);

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function redactWith(value: unknown, keys: Set<string>): unknown {
  if (Array.isArray(value)) return value.map((item) => redactWith(item, keys));
  if (isRecord(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      out[key] = keys.has(normalizeKey(key))
        ? REDACTED
        : redactWith(nested, keys);
    }
    return out;
  }
  return value;
}

/**
 * Redacción COMPLETA para exportar (copiar/PNG/guardar): tokens, contraseñas,
 * identificadores sensibles y datos personales. Conserva nombres y estructura.
 */
export function redactSessionValue(value: unknown): unknown {
  return redactWith(value, SENSITIVE_KEYS);
}

/**
 * Redacción mínima para la vista en pantalla: solo tokens/credenciales
 * (Authorization, accessToken, sessionKey). Mantiene visibles MDD4, MDD32,
 * MDD75, MDD77 y los seis campos del dataMap para su revisión.
 */
export function redactSessionSecrets(value: unknown): unknown {
  return redactWith(value, SECRET_KEYS);
}

/**
 * Activación explícita y por defecto desactivada. Solo TEST + flag opt-in.
 */
export function isSessionDiagnosticsEnabled(
  environment = process.env.PAYMENT_ENVIRONMENT,
): boolean {
  return (
    environment?.toUpperCase() === "TEST" &&
    process.env.NIUBIZ_TEST_SESSION_DIAGNOSTICS_ENABLED === "true"
  );
}

export function generateSessionCorrelationId(): string {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return `session-${random}`;
}

export function captureSessionRequest(
  _config: NiubizTestConfig,
  request: NiubizSessionRequest,
  correlationId: string,
): void {
  if (!isSessionDiagnosticsEnabled()) return;
  console.info(
    "[NIUBIZ_SESSION_DIAGNOSTIC_REQUEST]",
    JSON.stringify({
      correlationId,
      method: request.method,
      url: request.url,
      headers: redactSessionValue(request.headers),
      body: redactSessionValue(request.body),
    }),
  );
}

export function captureSessionResponse(
  _config: NiubizTestConfig,
  correlationId: string,
  httpStatus: number,
  body: unknown,
): void {
  if (!isSessionDiagnosticsEnabled()) return;
  console.info(
    "[NIUBIZ_SESSION_DIAGNOSTIC_RESPONSE]",
    JSON.stringify({
      correlationId,
      httpStatus,
      body: redactSessionValue(body),
    }),
  );
}

export function captureSessionFailure(
  _config: NiubizTestConfig,
  correlationId: string,
  httpStatus: number,
): void {
  if (!isSessionDiagnosticsEnabled()) return;
  console.info(
    "[NIUBIZ_SESSION_DIAGNOSTIC_RESPONSE]",
    JSON.stringify({ correlationId, httpStatus, body: null }),
  );
}

/**
 * Pausa de certificación (NIUBIZ-CERT-LOCAL-02).
 *
 * Activación explícita y por defecto desactivada. Gating acumulativo:
 * - Solo en desarrollo LOCAL (NODE_ENV=development).
 * - Solo con credenciales Niubiz TEST (PAYMENT_ENVIRONMENT=TEST + PAYMENT_PROVIDER=NIUBIZ).
 * - Solo con el flag opt-in NIUBIZ_CERT_PAUSE_AFTER_SESSION=true.
 *
 * QA y PROD corren con NODE_ENV distinto de "development" y PAYMENT_ENVIRONMENT
 * distinto de TEST, por lo que este modo queda excluido por construcción. No
 * interrumpe la solicitud real de sesión: únicamente detiene la transición hacia
 * Checkout.js.
 */
export function isCertPauseEnabled(
  nodeEnv = process.env.NODE_ENV,
  environment = process.env.PAYMENT_ENVIRONMENT,
  provider = process.env.PAYMENT_PROVIDER,
  flag = process.env.NIUBIZ_CERT_PAUSE_AFTER_SESSION,
): boolean {
  return (
    nodeEnv === "development" &&
    environment?.toUpperCase() === "TEST" &&
    provider?.toUpperCase() === "NIUBIZ" &&
    flag === "true"
  );
}

/**
 * Verifica la presencia de los MDD requeridos y de los seis campos del dataMap
 * sobre el request REAL (sin redactar), antes de emitir la evidencia redactada.
 */
export function verifySessionEvidence(request: NiubizSessionRequest): NiubizSessionDiagnostic["verification"] {
  const merchantDefineData = request.body.antifraud?.merchantDefineData ?? {};
  const dataMap = request.body.dataMap ?? {};
  const registeredState = merchantDefineData.MDD75;

  const mdd4 = typeof merchantDefineData.MDD4 === "string" && merchantDefineData.MDD4.length > 0;
  const mdd32 = typeof merchantDefineData.MDD32 === "string" && merchantDefineData.MDD32.length > 0;
  const mdd75 = registeredState === "Registrado" || registeredState === "Invitado" || registeredState === "Empleado";
  const mdd77Present = merchantDefineData.MDD77 !== undefined;
  const mdd77Valid = typeof merchantDefineData.MDD77 === "number" && Number.isInteger(merchantDefineData.MDD77) && merchantDefineData.MDD77 > 0;
  const mdd77 = registeredState === "Invitado" ? merchantDefineData.MDD77 === 1 : (mdd77Present ? mdd77Valid : true);

  const dataMapFields = CARDHOLDER_DATA_MAP_FIELDS.filter((field) => {
    const value = dataMap[field];
    return value !== undefined && value !== null && String(value).length > 0;
  });
  const missingDataMapFields = CARDHOLDER_DATA_MAP_FIELDS.filter((field) => !dataMapFields.includes(field));

  return {
    mdd4,
    mdd32,
    mdd75,
    mdd77,
    mdd77Present,
    ...(registeredState === "Registrado" && !mdd77Present
      ? { mdd77Note: "MDD77 omitido para cliente Registrado: la semántica del día de registro no está confirmada; no se inventa un valor." }
      : {}),
    dataMapFields: [...dataMapFields],
    missingDataMapFields: [...missingDataMapFields],
  };
}

/**
 * Construye la evidencia de sesión (request + response) para la vista de
 * diagnóstico. Incluye dos representaciones:
 * - `request`/`response`: JSON real con solo tokens redactados (MDD/dataMap visibles).
 * - `redacted`: versión completamente redactada para exportar.
 */
export function buildSessionDiagnostic(
  request: NiubizSessionRequest,
  httpStatus: number,
  responseBody: unknown,
  correlationId: string,
  stages: NiubizStageTrace[] = [],
): NiubizSessionDiagnostic {
  const evidence = {
    request: {
      method: request.method,
      url: request.url,
      headers: redactSessionSecrets(request.headers) as Record<string, unknown>,
      body: redactSessionSecrets(request.body),
    },
    response: {
      httpStatus,
      body: redactSessionSecrets(responseBody),
    },
  };

  return {
    correlationId,
    origin: "NIUBIZ_TEST_LOCAL",
    capturedAt: new Date().toISOString(),
    stages,
    ...evidence,
    redacted: {
      request: {
        method: request.method,
        url: request.url,
        headers: redactSessionValue(request.headers) as Record<string, unknown>,
        body: redactSessionValue(request.body),
      },
      response: {
        httpStatus,
        body: redactSessionValue(responseBody),
      },
    },
    verification: verifySessionEvidence(request),
  };
}
