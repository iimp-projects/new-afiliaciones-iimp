const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;
const MAX_RAW_LENGTH = 2048;
const VERIFY_PATH = /^\/verificar-carnet\/([A-Za-z0-9_-]{16,64})\/?$/;

function allowedOrigins(baseUrls: readonly string[]): Set<string> {
  const origins = new Set<string>();
  for (const base of baseUrls) {
    try {
      origins.add(new URL(base).origin);
    } catch {
      // Configuración inválida: se ignora este origen.
    }
  }
  return origins;
}

/**
 * Extrae el token de verificación desde un QR (URL o token crudo) sin realizar
 * ninguna solicitud de red. Los orígenes permitidos provienen de la
 * configuración del entorno, evitando SSRF y URLs arbitrarias.
 */
export function extractVerificationToken(raw: string | null | undefined, baseUrls: readonly string[]): string | null {
  const value = raw?.trim();
  if (!value || value.length > MAX_RAW_LENGTH) return null;
  if (TOKEN_PATTERN.test(value)) return value;

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  if (!allowedOrigins(baseUrls).has(parsed.origin)) return null;
  const match = VERIFY_PATH.exec(parsed.pathname);
  return match?.[1] ?? null;
}
