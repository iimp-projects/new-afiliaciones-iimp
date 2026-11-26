import { X509Certificate } from "node:crypto";
import { readFileSync } from "node:fs";
import { ConfigurationError, type EnvSource } from "./env";
import { getAppBaseUrl } from "./env";

/**
 * Configuración server-side de las billeteras digitales.
 *
 * Ningún valor de este módulo debe importarse desde componentes cliente:
 * contiene material criptográfico (claves de servicio, certificados y el
 * secreto de autenticación del pase). Los mensajes de error nunca incluyen
 * valores, únicamente nombres de variables.
 */

export interface WalletFlags {
  readonly googleEnabled: boolean;
  readonly appleEnabled: boolean;
}

export interface GoogleServiceAccount {
  readonly clientEmail: string;
  readonly privateKey: string;
  readonly projectId?: string;
}

export type WalletProviderMode = "REAL" | "SIMULATION";

export interface GoogleWalletConfig {
  readonly issuerId: string;
  readonly classId: string;
  /** Prefijo del namespace de objetos, p. ej. `iimp_card_` (LOCAL) o `iimp_qa_card_` (QA). */
  readonly objectPrefix: string;
  readonly serviceAccount: GoogleServiceAccount;
  readonly classAutoCreate: boolean;
  /** Allowlist QA por personId y/o prefijo de código de asociado. Vacía = sin restricción. */
  readonly allowedPersonIds: readonly number[];
  readonly allowedAssociateCodePrefixes: readonly string[];
}

const DEFAULT_GWALLET_OBJECT_PREFIX = "iimp_card_";

function normalizeObjectPrefix(value: string | null): string | null {
  const prefix = (value ?? DEFAULT_GWALLET_OBJECT_PREFIX).trim();
  return /^[A-Za-z0-9_]+$/.test(prefix) ? prefix : null;
}

function parseCsv(value: string | undefined): string[] {
  return (value ?? "").split(",").map((entry) => entry.trim()).filter(Boolean);
}

function parsePersonIds(value: string | undefined): number[] {
  return parseCsv(value)
    .map((entry) => Number(entry))
    .filter((entry) => Number.isInteger(entry) && entry > 0);
}

/**
 * Restricción de emisión para ambientes con datos institucionales (QA). Sin
 * allowlist configurada no restringe (LOCAL). Con allowlist, solo autoriza por
 * personId o por prefijo de código de asociado sintético.
 */
export function isGoogleWalletEmissionAllowed(
  config: GoogleWalletConfig,
  subject: { readonly personId: number; readonly associateCode: string | null },
): boolean {
  const restricted = config.allowedPersonIds.length > 0 || config.allowedAssociateCodePrefixes.length > 0;
  if (!restricted) return true;
  if (config.allowedPersonIds.includes(subject.personId)) return true;
  const code = subject.associateCode?.trim();
  if (code && config.allowedAssociateCodePrefixes.some((prefix) => code.startsWith(prefix))) return true;
  return false;
}

export interface AppleApnsConfig {
  readonly keyId: string;
  readonly teamId: string;
  readonly privateKeyPem: string;
}

export interface AppleWalletConfig {
  readonly teamIdentifier: string;
  readonly passTypeIdentifier: string;
  readonly organizationName: string;
  /**
   * Capacidad de actualización (PassKit Web Service + APNs). Por defecto `true`
   * para preservar QA/PROD. En LOCAL se desactiva explícitamente para emitir
   * pases estáticos sin HTTPS ni registro de dispositivos.
   */
  readonly updatesEnabled: boolean;
  readonly webServiceUrl: string | null;
  readonly certificatePem: string;
  readonly privateKeyPem: string;
  readonly wwdrCertificatePem: string;
  /** Passphrase de la clave privada cifrada. Solo servidor; nunca se registra. */
  readonly keyPassphrase: string | null;
  /** Ruta explícita al binario openssl; si es null se resuelve por PATH. */
  readonly opensslPath: string | null;
  readonly authenticationSecret: string;
  readonly authenticationSecretVersion: number;
  readonly previousAuthenticationSecret: string | null;
  readonly previousAuthenticationSecretVersion: number | null;
  readonly apns: AppleApnsConfig | null;
}

export interface WalletSyncConfig {
  readonly enabled: boolean;
  readonly batchSize: number;
  readonly maxAttempts: number;
  readonly leaseSeconds: number;
  readonly intervalSeconds: number;
}

export interface WalletConfig {
  readonly appBaseUrl: string;
  readonly flags: WalletFlags;
  readonly modes: { readonly google: WalletProviderMode; readonly apple: WalletProviderMode };
  readonly google: GoogleWalletConfig | null;
  readonly apple: AppleWalletConfig | null;
}

function isEnabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

function text(env: EnvSource, name: string): string | null {
  const value = env[name]?.trim();
  return value ? value : null;
}

function decodeBase64(value: string, variable: string): string {
  try {
    const decoded = Buffer.from(value, "base64").toString("utf8").trim();
    if (!decoded) throw new Error("empty");
    return decoded;
  } catch {
    throw new Error(`${variable} no contiene un valor base64 válido.`);
  }
}

export function isCertificateCurrentlyValid(pem: string, now: Date = new Date()): boolean {
  try {
    const certificate = new X509Certificate(pem);
    return now >= new Date(certificate.validFrom) && now <= new Date(certificate.validTo);
  } catch {
    return false;
  }
}

/**
 * Devuelve el valor tal cual (sin trim) para secretos como la passphrase,
 * donde los espacios pueden ser significativos. Vacío = no configurado.
 */
function rawText(env: EnvSource, name: string): string | null {
  const value = env[name];
  return value !== undefined && value.length > 0 ? value : null;
}

function normalizePem(value: string): string {
  return value.replace(/\r\n/g, "\n").trim();
}

function readPemFile(env: EnvSource, fileVariable: string): string {
  const file = text(env, fileVariable);
  if (!file) throw new ConfigurationError([{ variable: fileVariable, reason: "es obligatorio" }]);
  let contents: string;
  try {
    contents = readFileSync(file, "utf8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    const reason = code === "ENOENT"
      ? "el archivo no existe"
      : code === "EACCES" || code === "EPERM"
        ? "el archivo no es legible"
        : "el archivo no se pudo leer";
    throw new ConfigurationError([{ variable: fileVariable, reason }]);
  }
  if (!contents.includes("-----BEGIN")) {
    throw new ConfigurationError([{ variable: fileVariable, reason: "no contiene un PEM válido" }]);
  }
  return contents;
}

interface ApplePemSources {
  readonly base64: string;
  readonly inline: string;
  readonly file?: string;
}

/**
 * Resuelve un PEM de Apple desde fuentes mutuamente excluyentes.
 *
 * Precedencia cuando varias fuentes configuradas son equivalentes:
 *   Base64  >  PEM inline  >  archivo
 * Si dos fuentes configuradas difieren, se rechaza por configuración ambigua.
 * Nunca se devuelve ni se registra el contenido en los mensajes de error.
 */
function resolvePem(env: EnvSource, sources: ApplePemSources): string | null {
  const resolved: Array<{ variable: string; value: string }> = [];
  const base64 = text(env, sources.base64);
  if (base64) {
    const decoded = decodeBase64(base64, sources.base64);
    if (!decoded.includes("-----BEGIN")) {
      throw new ConfigurationError([{ variable: sources.base64, reason: "no contiene un PEM válido" }]);
    }
    resolved.push({ variable: sources.base64, value: decoded });
  }
  const inline = text(env, sources.inline);
  if (inline) {
    if (!inline.includes("-----BEGIN")) {
      throw new ConfigurationError([{ variable: sources.inline, reason: "no contiene un PEM válido" }]);
    }
    resolved.push({ variable: sources.inline, value: inline });
  }
  if (sources.file && text(env, sources.file)) {
    resolved.push({ variable: sources.file, value: readPemFile(env, sources.file) });
  }
  if (resolved.length === 0) return null;
  const expected = normalizePem(resolved[0].value);
  if (resolved.slice(1).some((entry) => normalizePem(entry.value) !== expected)) {
    throw new ConfigurationError([
      {
        variable: resolved.map((entry) => entry.variable).join(" / "),
        reason: "definen contenidos PEM distintos; configure una sola fuente por credencial",
      },
    ]);
  }
  return resolved[0].value.trim();
}

function parseServiceAccount(env: EnvSource): GoogleServiceAccount | null {
  const inline = text(env, "GOOGLE_WALLET_SERVICE_ACCOUNT_JSON");
  const base64 = text(env, "GOOGLE_WALLET_SERVICE_ACCOUNT_JSON_B64");
  const file = text(env, "GOOGLE_WALLET_CREDENTIALS_FILE");
  let json: string | null = null;
  let sourceName = "GOOGLE_WALLET_SERVICE_ACCOUNT_JSON";
  if (inline) {
    json = inline.trim().startsWith("{") ? inline : decodeBase64(inline, "GOOGLE_WALLET_SERVICE_ACCOUNT_JSON_B64");
  } else if (base64) {
    json = decodeBase64(base64, "GOOGLE_WALLET_SERVICE_ACCOUNT_JSON_B64");
  } else if (file) {
    sourceName = "GOOGLE_WALLET_CREDENTIALS_FILE";
    try {
      json = readFileSync(file, "utf8");
    } catch {
      throw new Error("GOOGLE_WALLET_CREDENTIALS_FILE no se pudo leer.");
    }
  }
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as { type?: unknown; project_id?: unknown; client_email?: unknown; private_key?: unknown };
    if (parsed.type !== undefined && parsed.type !== "service_account") return null;
    if (typeof parsed.client_email !== "string" || typeof parsed.private_key !== "string") return null;
    if (!parsed.private_key.includes("-----BEGIN")) return null;
    return {
      clientEmail: parsed.client_email,
      privateKey: parsed.private_key,
      projectId: typeof parsed.project_id === "string" ? parsed.project_id : undefined,
    };
  } catch {
    throw new Error(`${sourceName} no contiene un JSON válido.`);
  }
}

function normalizeClassId(issuerId: string, configured: string): string {
  return configured.includes(".") ? configured : `${issuerId}.${configured}`;
}

function boundedInt(env: EnvSource, name: string, fallback: number, minimum: number, maximum: number): number {
  const raw = env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < minimum || value > maximum) return fallback;
  return value;
}

export function getWalletSyncConfig(env: EnvSource = process.env): WalletSyncConfig {
  return {
    enabled: isEnabled(env.CARD_WALLET_SYNC_ENABLED),
    batchSize: boundedInt(env, "CARD_WALLET_SYNC_BATCH_SIZE", 25, 1, 200),
    maxAttempts: boundedInt(env, "CARD_WALLET_SYNC_MAX_ATTEMPTS", 8, 1, 50),
    leaseSeconds: boundedInt(env, "CARD_WALLET_SYNC_LEASE_SECONDS", 120, 30, 3600),
    intervalSeconds: boundedInt(env, "CARD_WALLET_SYNC_INTERVAL_SECONDS", 60, 15, 3600),
  };
}

export function getWalletFlags(env: EnvSource = process.env): WalletFlags {
  return {
    googleEnabled: isEnabled(env.CARD_GOOGLE_WALLET_ENABLED),
    appleEnabled: isEnabled(env.CARD_APPLE_WALLET_ENABLED),
  };
}

/**
 * Simulación local de billeteras. Nunca puede activarse con NODE_ENV=production,
 * aunque la variable esté presente por error. No reemplaza credenciales reales:
 * solo habilita una vista previa local sin llamadas externas.
 */
export function getWalletSimulationEnabled(env: EnvSource = process.env): boolean {
  if (env.NODE_ENV === "production") return false;
  return env.CARD_WALLET_LOCAL_SIMULATION?.trim().toLowerCase() === "true";
}

/** Fuerza un fallo transitorio de sincronización solo en simulación local. */
export function getWalletSimulationFailure(env: EnvSource = process.env): "GOOGLE" | "APPLE" | null {
  if (!getWalletSimulationEnabled(env)) return null;
  const value = env.CARD_WALLET_LOCAL_SIMULATION_FAILURE?.trim().toUpperCase();
  return value === "GOOGLE" || value === "APPLE" ? value : null;
}

/**
 * Modo por proveedor. En producción la simulación nunca se habilita, aunque
 * exista la variable. `CARD_<PROVIDER>_WALLET_MODE` permite convivir con Google
 * real y Apple simulado en local.
 */
export function getWalletProviderMode(provider: "GOOGLE" | "APPLE", env: EnvSource = process.env): WalletProviderMode {
  if (env.NODE_ENV === "production") return "REAL";
  const configured = env[`CARD_${provider}_WALLET_MODE`]?.trim().toUpperCase();
  if (configured === "REAL") return "REAL";
  if (configured === "SIMULATION") return "SIMULATION";
  return getWalletSimulationEnabled(env) ? "SIMULATION" : "REAL";
}

export function isWalletProviderSimulation(provider: "GOOGLE" | "APPLE", env: EnvSource = process.env): boolean {
  return getWalletProviderMode(provider, env) === "SIMULATION";
}

export function getGoogleWalletConfig(env: EnvSource = process.env): GoogleWalletConfig | null {
  const issuerId = text(env, "GOOGLE_WALLET_ISSUER_ID");
  const classId = text(env, "GOOGLE_WALLET_CLASS_ID");
  const serviceAccount = parseServiceAccount(env);
  const objectPrefix = normalizeObjectPrefix(text(env, "GOOGLE_WALLET_OBJECT_PREFIX"));
  if (!issuerId || !classId || !serviceAccount || !objectPrefix) return null;
  const normalizedClassId = normalizeClassId(issuerId, classId);
  // Falla de forma segura si la clase configurada no pertenece al issuer: evita
  // que un ambiente modifique clases de otro emisor/entorno por error.
  if (!normalizedClassId.startsWith(`${issuerId}.`)) return null;
  return {
    issuerId,
    classId: normalizedClassId,
    objectPrefix,
    serviceAccount,
    classAutoCreate: env.GOOGLE_WALLET_CLASS_AUTO_CREATE?.trim().toLowerCase() !== "false",
    allowedPersonIds: parsePersonIds(env.CARD_WALLET_ALLOWED_PERSON_IDS),
    allowedAssociateCodePrefixes: parseCsv(env.CARD_WALLET_ALLOWED_ASSOCIATE_PREFIXES),
  };
}

/**
 * Capacidad de actualización de Apple Wallet. `false` desactiva PassKit Web
 * Service y APNs para permitir emitir pases estáticos. Por defecto `true` para
 * no alterar QA/PROD; LOCAL debe desactivarla explícitamente.
 */
export function getAppleWalletUpdatesEnabled(env: EnvSource = process.env): boolean {
  return env.APPLE_WALLET_UPDATES_ENABLED?.trim().toLowerCase() !== "false";
}

/**
 * Configuración de Apple Wallet.
 *
 * Fuentes de credenciales (por credencial, en orden de precedencia):
 *   Base64 (`*_B64`) > PEM inline (`*_PEM`) > archivo (`*_FILE`).
 * Configurar varias fuentes con contenido distinto se considera ambiguo y se
 * rechaza con `ConfigurationError` (solo se nombran variables, nunca valores).
 *
 * Con `APPLE_WALLET_UPDATES_ENABLED=false` se omite `APPLE_WALLET_WEB_SERVICE_URL`
 * y el secreto HMAC: el pase es estático (sin webServiceURL/authenticationToken).
 * Con actualizaciones habilitadas se mantiene la exigencia de HTTPS y secreto.
 */
export function getAppleWalletConfig(env: EnvSource = process.env): AppleWalletConfig | null {
  const teamIdentifier = text(env, "APPLE_WALLET_TEAM_ID");
  const passTypeIdentifier = text(env, "APPLE_WALLET_PASS_TYPE_ID");
  const certificatePem = resolvePem(env, {
    base64: "APPLE_WALLET_PASS_CERT_B64",
    inline: "APPLE_WALLET_PASS_CERT_PEM",
    file: "APPLE_WALLET_PASS_CERT_FILE",
  });
  const privateKeyPem = resolvePem(env, {
    base64: "APPLE_WALLET_PASS_KEY_B64",
    inline: "APPLE_WALLET_PASS_KEY_PEM",
    file: "APPLE_WALLET_PASS_KEY_FILE",
  });
  const wwdrCertificatePem = resolvePem(env, {
    base64: "APPLE_WALLET_WWDR_CERT_B64",
    inline: "APPLE_WALLET_WWDR_CERT_PEM",
    file: "APPLE_WALLET_WWDR_CERT_FILE",
  });
  if (!teamIdentifier || !passTypeIdentifier || !certificatePem || !privateKeyPem || !wwdrCertificatePem) return null;
  if (!isCertificateCurrentlyValid(certificatePem) || !isCertificateCurrentlyValid(wwdrCertificatePem)) return null;

  const updatesEnabled = getAppleWalletUpdatesEnabled(env);
  let webServiceUrl: string | null = null;
  let authenticationSecret = "";
  let authenticationSecretVersion = 1;
  let previousAuthenticationSecret: string | null = null;
  let previousAuthenticationSecretVersion: number | null = null;
  let apns: AppleApnsConfig | null = null;

  if (updatesEnabled) {
    const configuredWebService = text(env, "APPLE_WALLET_WEB_SERVICE_URL");
    const appBaseUrl = getAppBaseUrl(env, { allowDevDefault: true });
    webServiceUrl = configuredWebService ?? `${appBaseUrl}/api/afiliaciones/carnet/wallet/apple`;
    if (!webServiceUrl.startsWith("https://")) return null;

    const secret = text(env, "CARD_WALLET_PASS_AUTH_SECRET");
    if (!secret || secret.length < 32) return null;
    authenticationSecret = secret;
    authenticationSecretVersion = boundedInt(env, "CARD_WALLET_PASS_AUTH_SECRET_VERSION", 1, 1, 1_000_000);
    previousAuthenticationSecret = text(env, "CARD_WALLET_PASS_AUTH_SECRET_PREVIOUS");
    previousAuthenticationSecretVersion = previousAuthenticationSecret
      ? boundedInt(env, "CARD_WALLET_PASS_AUTH_SECRET_PREVIOUS_VERSION", Math.max(1, authenticationSecretVersion - 1), 1, 1_000_000)
      : null;
    if (previousAuthenticationSecret && previousAuthenticationSecret.length < 32) return null;
    if (previousAuthenticationSecret && previousAuthenticationSecretVersion === authenticationSecretVersion) return null;

    const apnsKeyId = text(env, "APPLE_WALLET_APNS_KEY_ID");
    const apnsPrivateKey = resolvePem(env, {
      base64: "APPLE_WALLET_APNS_KEY_B64",
      inline: "APPLE_WALLET_APNS_KEY_PEM",
    });
    const apnsTeamId = text(env, "APPLE_WALLET_APNS_TEAM_ID") ?? teamIdentifier;
    apns = apnsKeyId && apnsPrivateKey && apnsTeamId
      ? { keyId: apnsKeyId, teamId: apnsTeamId, privateKeyPem: apnsPrivateKey }
      : null;
  }

  return {
    teamIdentifier,
    passTypeIdentifier,
    organizationName: text(env, "APPLE_WALLET_ORGANIZATION_NAME") ?? "Instituto de Ingenieros de Minas del Perú",
    updatesEnabled,
    webServiceUrl,
    certificatePem,
    privateKeyPem,
    wwdrCertificatePem,
    keyPassphrase: rawText(env, "APPLE_WALLET_PASS_KEY_PASSPHRASE"),
    opensslPath: text(env, "APPLE_WALLET_OPENSSL_PATH"),
    authenticationSecret,
    authenticationSecretVersion,
    previousAuthenticationSecret,
    previousAuthenticationSecretVersion,
    apns,
  };
}

export function getWalletConfig(env: EnvSource = process.env): WalletConfig {
  return {
    appBaseUrl: getAppBaseUrl(env, { allowDevDefault: true }),
    flags: getWalletFlags(env),
    modes: { google: getWalletProviderMode("GOOGLE", env), apple: getWalletProviderMode("APPLE", env) },
    google: getGoogleWalletConfig(env),
    apple: getAppleWalletConfig(env),
  };
}
