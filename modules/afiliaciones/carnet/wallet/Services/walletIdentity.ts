import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export interface AppleTokenSecret {
  readonly version: number;
  readonly secret: string;
}

export function googleWalletObjectId(issuerId: string, cardId: string): string {
  return `${issuerId}.iimp_card_${cardId}`;
}

export function appleWalletSerialNumber(cardId: string): string {
  return `iimp-card-${cardId}`;
}

export function cardVerificationUrl(appBaseUrl: string, verificationToken: string): string {
  return `${appBaseUrl.replace(/\/+$/, "")}/verificar-carnet/${encodeURIComponent(verificationToken)}`;
}

function computeToken(secret: string, serialNumber: string): string {
  return createHmac("sha256", secret).update(`apple-wallet-pass:${serialNumber}`).digest("base64url");
}

/**
 * Token de autenticación del pase Apple versionado (`<version>.<hmac>`).
 * Se deriva de un secreto exclusivo del servidor y del serial estable: no se
 * persiste ni se envía al portal. La versión permite rotar el secreto sin
 * invalidar pases ya instalados.
 */
export function deriveApplePassAuthenticationToken(secret: string, serialNumber: string, version = 1): string {
  if (secret.length < 32) throw new Error("El secreto del pase es insuficiente.");
  if (!Number.isInteger(version) || version < 1) throw new Error("La versión del secreto no es válida.");
  return `${version}.${computeToken(secret, serialNumber)}`;
}

export function appleTokenVersion(token: string): number | null {
  const match = /^(\d+)\./.exec(token);
  if (!match) return null;
  const version = Number(match[1]);
  return Number.isInteger(version) && version > 0 ? version : null;
}

export function appleAuthenticationSecrets(config: {
  readonly authenticationSecret: string;
  readonly authenticationSecretVersion: number;
  readonly previousAuthenticationSecret: string | null;
  readonly previousAuthenticationSecretVersion: number | null;
}): AppleTokenSecret[] {
  const secrets: AppleTokenSecret[] = [{ version: config.authenticationSecretVersion, secret: config.authenticationSecret }];
  if (config.previousAuthenticationSecret && config.previousAuthenticationSecretVersion !== null) {
    secrets.push({ version: config.previousAuthenticationSecretVersion, secret: config.previousAuthenticationSecret });
  }
  return secrets;
}

export function resolveAppleTokenSecret(secrets: readonly AppleTokenSecret[], version: number): string | null {
  return secrets.find((entry) => entry.version === version)?.secret ?? null;
}

export function verifyApplePassAuthenticationToken(
  secrets: readonly AppleTokenSecret[],
  serialNumber: string,
  provided: string,
): boolean {
  if (secrets.length === 0 || !provided) return false;
  const version = appleTokenVersion(provided);
  const candidates = version === null ? secrets : secrets.filter((entry) => entry.version === version);
  if (candidates.length === 0) return false;

  const providedBytes = Buffer.from(provided);
  let valid = false;
  for (const entry of candidates) {
    const expected = version === null ? computeToken(entry.secret, serialNumber) : `${entry.version}.${computeToken(entry.secret, serialNumber)}`;
    const expectedBytes = Buffer.from(expected);
    if (expectedBytes.length === providedBytes.length && timingSafeEqual(expectedBytes, providedBytes)) valid = true;
  }
  return valid;
}

/**
 * Clave de rate limiting para los endpoints PassKit. No persiste ni registra el
 * identificador completo del dispositivo.
 */
export function passKitRateLimitKey(deviceLibraryIdentifier: string): string {
  return `passkit:${createHmac("sha256", "passkit-rate-limit").update(deviceLibraryIdentifier).digest("hex").slice(0, 24)}`;
}

export function randomAuditCorrelationId(): string {
  return randomBytes(12).toString("base64url");
}
