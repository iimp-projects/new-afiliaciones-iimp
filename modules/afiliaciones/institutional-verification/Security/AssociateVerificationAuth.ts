import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Autenticación técnica servidor a servidor de la API de verificación de
 * asociados. Comparación en tiempo constante para evitar fugas por timing.
 * Nunca registra ni expone el token completo.
 */
export function readBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) return null;
  const token = match[1].trim();
  return token.length > 0 ? token : null;
}

export function isAuthorizedBearer(token: string | null, expected: string): boolean {
  if (!token) return false;
  const received = createHash("sha256").update(token).digest();
  const wanted = createHash("sha256").update(expected).digest();
  return received.length === wanted.length && timingSafeEqual(received, wanted);
}
