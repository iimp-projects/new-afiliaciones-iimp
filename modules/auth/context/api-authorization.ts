import type { CurrentUserDTO } from "./types";
import { isAffiliateUser } from "./types";
import { contextService } from "./service";

export class ApiAuthorizationError extends Error {
  public constructor(message: string, public readonly status: 401 | 403) {
    super(message);
  }
}

/**
 * Devuelve el usuario solo si es una identidad interna válida.
 *
 * Un afiliado externo (ASOCIADO_ACTIVO/ASOCIADO_ESTUDIANTE o type AFFILIATE)
 * nunca es una identidad interna aunque comparta permisos usados internamente
 * como `read:memberships`. Las APIs administrativas deben usar este helper en
 * lugar de `getCurrentUser()` para decidir el modo interno.
 */
export async function getInternalApiUser(): Promise<CurrentUserDTO | null> {
  const user = await contextService.getCurrentUser();
  if (!user || user.status !== "ACTIVE" || isAffiliateUser(user)) return null;
  return user;
}

export async function requireApiPermission(action: string, subject: string): Promise<CurrentUserDTO> {
  const user = await contextService.getCurrentUser();
  if (!user || user.status !== "ACTIVE") {
    throw new ApiAuthorizationError("No autenticado.", 401);
  }
  if (isAffiliateUser(user)) {
    throw new ApiAuthorizationError("No autorizado.", 403);
  }
  if (!(await contextService.hasPermission(action, subject))) {
    throw new ApiAuthorizationError("No autorizado.", 403);
  }
  return user;
}

export function apiAuthorizationStatus(error: unknown, fallback = 500): number {
  return error instanceof ApiAuthorizationError ? error.status : fallback;
}
