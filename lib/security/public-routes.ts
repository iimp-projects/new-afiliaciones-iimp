export const PUBLIC_ROUTE_PREFIXES = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/activar-cuenta",
  "/postulacion",
  "/afiliaciones",
  "/beneficios",
  "/consulta",
  "/sap",
] as const;

export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTE_PREFIXES.some((route) => pathname.startsWith(route));
}
