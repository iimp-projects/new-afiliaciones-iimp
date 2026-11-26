/**
 * Comprueba que una petición mutante provenga del mismo origen público.
 * Los navegadores envían `Origin` en POST; su ausencia se rechaza para evitar
 * CSRF con cookies de sesión.
 */
export function isSameOriginRequest(request: Request, allowedBaseUrl: string): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(allowedBaseUrl).origin;
  } catch {
    return false;
  }
}
