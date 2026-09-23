import crypto from "node:crypto";
import { getAuthSecret as readAuthSecret } from "@/lib/config/env";

const CONTEXT = "password-reset";

function getAuthSecret(): string {
  try {
    return readAuthSecret();
  } catch {
    throw new Error("AUTH_SECRET no configurado: no se puede emitir un token de recuperación seguro.");
  }
}

function hmacCode(secret: string, code: string): string {
  return crypto.createHmac("sha256", secret).update(`${CONTEXT}:${code}`).digest("hex");
}

/**
 * Crea el hash HMAC-SHA256 del código de recuperación (6 dígitos) usando
 * AUTH_SECRET. Falla de forma segura si el secreto no está configurado: nunca
 * se emiten tokens nuevos con SHA-256 sin clave.
 */
export function hashVerificationCode(code: string): string {
  return hmacCode(getAuthSecret(), code);
}

/** Hash heredado (SHA-256 sin clave) para tokens emitidos antes del hardening. */
export function legacyHashVerificationCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

/**
 * Candidatos aceptados al verificar: HMAC actual (si hay secreto) y SHA-256
 * legacy. La aceptación legacy es solo compatibilidad y no extiende la vida del
 * token: la expiración la aplica el repositorio en cada consumo.
 */
export function verificationCodeCandidates(code: string): string[] {
  const candidates = new Set<string>();
  try {
    candidates.add(hmacCode(readAuthSecret(), code));
  } catch {
    // Sin AUTH_SECRET solo se acepta el hash legacy; no se puede validar el HMAC.
  }
  candidates.add(legacyHashVerificationCode(code));
  return [...candidates];
}
