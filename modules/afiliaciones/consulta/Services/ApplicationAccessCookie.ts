import type { NextResponse } from "next/server";
import { QUERY_ACCESS_TTL_SECONDS, QUERY_COOKIE, queryAuthorization } from "./QueryAuthorizationService";

/**
 * Emisión centralizada de la cookie de acceso a la postulación. Concentra los
 * atributos (HttpOnly/Secure/SameSite/Path/Max-Age) para que los endpoints no
 * los dupliquen.
 */
export function setApplicationAccessCookie(response: NextResponse, token: string): NextResponse {
  response.cookies.set(QUERY_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api",
    maxAge: QUERY_ACCESS_TTL_SECONDS,
  });
  return response;
}

/**
 * Renueva la cookie solo si el token actual sigue siendo VÁLIDO. Si el token
 * está ausente, expirado o es inválido, no hace nada (nunca revive acceso).
 */
export function renewApplicationAccessCookie(response: NextResponse, token: string | undefined): NextResponse {
  const renewed = queryAuthorization.renewAccess(token);
  if (renewed) return setApplicationAccessCookie(response, renewed);
  return response;
}
