import { X509Certificate } from "node:crypto";
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
}

export interface GoogleWalletConfig {
  readonly issuerId: string;
  readonly classId: string;
  readonly serviceAccount: GoogleServiceAccount;
  readonly classAutoCreate: boolean;
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
  const raw = text(env, "GOOGLE_WALLET_SERVICE_ACCOUNT_JSON") ?? text(env, "GOOGLE_WALLET_SERVICE_ACCOUNT_JSON_B64");
  if (!raw) return null;
  const json = raw.trim().startsWith("{") ? raw : decodeBase64(raw, "GOOGLE_WALLET_SERVICE_ACCOUNT_JSON_B64");
  try {
    const parsed = JSON.parse(json) as { client_email?: unknown; private_key?: unknown };
    if (typeof parsed.client_email !== "string" || typeof parsed.private_key !== "string") return null;
    if (!parsed.private_key.includes("-----BEGIN")) return null;
    return { clientEmail: parsed.client_email, privateKey: parsed.private_key };
  } catch {
    throw new Error("GOOGLE_WALLET_SERVICE_ACCOUNT_JSON no contiene un JSON válido.");
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

export function getGoogleWalletConfig(env: EnvSource = process.env): GoogleWalletConfig | null {
  const issuerId = text(env, "GOOGLE_WALLET_ISSUER_ID");
  const classId = text(env, "GOOGLE_WALLET_CLASS_ID");
  const serviceAccount = parseServiceAccount(env);
  if (!issuerId || !classId || !serviceAccount) return null;
  return {
    issuerId,
    classId: normalizeClassId(issuerId, classId),
    serviceAccount,
    classAutoCreate: env.GOOGLE_WALLET_CLASS_AUTO_CREATE?.trim().toLowerCase() !== "false",
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
    google: getGoogleWalletConfig(env),
    apple: getAppleWalletConfig(env),
  };
}
