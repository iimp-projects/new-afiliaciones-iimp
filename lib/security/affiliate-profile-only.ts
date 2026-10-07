/**
 * R70 — Modo temporal "solo perfil" para asociados.
 *
 * Mientras esté activo, el intranet del asociado (ASOCIADO_ACTIVO y ASOCIADO_ESTUDIANTE)
 * muestra únicamente "Mi perfil" en el menú lateral (más "Cerrar sesión", que vive en el
 * footer del Sidebar) y bloquea el acceso directo al resto de secciones del portal
 * redirigiendo a la ruta de perfil.
 *
 * Reversibilidad: devolver `AFFILIATE_PROFILE_ONLY_MODE` a `false` restaura el menú y las
 * rutas completas del portal del asociado sin tocar ninguna otra capa.
 */
export const AFFILIATE_PROFILE_ONLY_MODE = true;

/** Ruta de aterrizaje (y única ruta permitida) del asociado en modo solo perfil. */
export const AFFILIATE_PROFILE_ONLY_ROUTE = "/intranet/mi-cuenta/perfil";

/** Ruta de aterrizaje histórica del asociado cuando el modo solo perfil está desactivado. */
const AFFILIATE_DEFAULT_ROUTE = "/intranet/mi-cuenta";

/** Únicos ítems de navegación del asociado permitidos en modo solo perfil. */
const AFFILIATE_PROFILE_ONLY_ALLOWED_ITEM_IDS = new Set<string>(["nav-affiliate-profile"]);

export function isAffiliateProfileOnlyItemAllowed(id: string): boolean {
  return AFFILIATE_PROFILE_ONLY_ALLOWED_ITEM_IDS.has(id);
}

export function getAffiliateLandingRoute(): string {
  return AFFILIATE_PROFILE_ONLY_MODE ? AFFILIATE_PROFILE_ONLY_ROUTE : AFFILIATE_DEFAULT_ROUTE;
}

export function isAffiliateProfileOnlyRestrictedRoute(pathname: string): boolean {
  if (!AFFILIATE_PROFILE_ONLY_MODE) return false;
  if (!pathname.startsWith(AFFILIATE_DEFAULT_ROUTE)) return false;
  if (pathname === AFFILIATE_PROFILE_ONLY_ROUTE || pathname.startsWith(`${AFFILIATE_PROFILE_ONLY_ROUTE}/`)) {
    return false;
  }
  return true;
}
