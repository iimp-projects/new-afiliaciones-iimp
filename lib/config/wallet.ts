import { X509Certificate } from "node:crypto";
import { readFileSync } from "node:fs";
import type { EnvSource } from "./env";
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
  readonly webServiceUrl: string | null;
  readonly certificatePem: string;
  readonly privateKeyPem: string;
  readonly wwdrCertificatePem: string;
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

function readPem(env: EnvSource, base64Variable: string, pathVariable: string): string | null {
  const base64 = text(env, base64Variable);
  if (base64) {
    const decoded = decodeBase64(base64, base64Variable);
    if (!decoded.includes("-----BEGIN")) {
      throw new Error(`${base64Variable} no contiene un PEM válido.`);
    }
    return decoded;
  }
  const pem = text(env, pathVariable);
  if (pem?.includes("-----BEGIN")) return pem;
  return null;
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
 * APPLE_WALLET_WEB_SERVICE_URL debe ser HTTPS para que Wallet pueda registrar
 * dispositivos. En desarrollo local (HTTP) se omite el servicio de actualización
 * y el pase sigue siendo descargable, sin registro PassKit.
 */
export function getAppleWalletConfig(env: EnvSource = process.env): AppleWalletConfig | null {
  const teamIdentifier = text(env, "APPLE_WALLET_TEAM_ID");
  const passTypeIdentifier = text(env, "APPLE_WALLET_PASS_TYPE_ID");
  const certificatePem = readPem(env, "APPLE_WALLET_PASS_CERT_B64", "APPLE_WALLET_PASS_CERT_PEM");
  const privateKeyPem = readPem(env, "APPLE_WALLET_PASS_KEY_B64", "APPLE_WALLET_PASS_KEY_PEM");
  const wwdrCertificatePem = readPem(env, "APPLE_WALLET_WWDR_CERT_B64", "APPLE_WALLET_WWDR_CERT_PEM");
  const authenticationSecret = text(env, "CARD_WALLET_PASS_AUTH_SECRET");
  const authenticationSecretVersion = boundedInt(env, "CARD_WALLET_PASS_AUTH_SECRET_VERSION", 1, 1, 1_000_000);
  const previousAuthenticationSecret = text(env, "CARD_WALLET_PASS_AUTH_SECRET_PREVIOUS");
  const previousAuthenticationSecretVersion = previousAuthenticationSecret
    ? boundedInt(env, "CARD_WALLET_PASS_AUTH_SECRET_PREVIOUS_VERSION", Math.max(1, authenticationSecretVersion - 1), 1, 1_000_000)
    : null;
  if (!teamIdentifier || !passTypeIdentifier || !certificatePem || !privateKeyPem || !wwdrCertificatePem) return null;
  if (!isCertificateCurrentlyValid(certificatePem) || !isCertificateCurrentlyValid(wwdrCertificatePem)) return null;
  if (!authenticationSecret || authenticationSecret.length < 32) return null;
  if (previousAuthenticationSecret && previousAuthenticationSecret.length < 32) return null;
  if (previousAuthenticationSecret && previousAuthenticationSecretVersion === authenticationSecretVersion) return null;

  const configuredWebService = text(env, "APPLE_WALLET_WEB_SERVICE_URL");
  const appBaseUrl = getAppBaseUrl(env, { allowDevDefault: true });
  const webServiceUrl = configuredWebService ?? `${appBaseUrl}/api/afiliaciones/carnet/wallet/apple`;
  if (!webServiceUrl.startsWith("https://")) return null;

  const apnsKeyId = text(env, "APPLE_WALLET_APNS_KEY_ID");
  const apnsPrivateKey = readPem(env, "APPLE_WALLET_APNS_KEY_B64", "APPLE_WALLET_APNS_KEY_PEM");
  const apnsTeamId = text(env, "APPLE_WALLET_APNS_TEAM_ID") ?? teamIdentifier;
  const apns = apnsKeyId && apnsPrivateKey && apnsTeamId
    ? { keyId: apnsKeyId, teamId: apnsTeamId, privateKeyPem: apnsPrivateKey }
    : null;

  return {
    teamIdentifier,
    passTypeIdentifier,
    organizationName: text(env, "APPLE_WALLET_ORGANIZATION_NAME") ?? "Instituto de Ingenieros de Minas del Perú",
    webServiceUrl,
    certificatePem,
    privateKeyPem,
    wwdrCertificatePem,
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
