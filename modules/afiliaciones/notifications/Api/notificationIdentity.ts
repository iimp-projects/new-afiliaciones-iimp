import { contextService } from "@/modules/auth/context/service";
import type { CurrentUserDTO } from "@/modules/auth/context/types";

/**
 * Identidad autenticada y activa para las APIs de notificaciones personales.
 *
 * A diferencia de `requireApiPermission`, no excluye a los asociados: cualquier
 * usuario activo puede consultar y gestionar sus propias notificaciones. El
 * alcance se garantiza en el servicio/repositorio filtrando siempre por `userId`.
 */
export async function requireNotificationIdentity(): Promise<CurrentUserDTO | null> {
  const user = await contextService.getCurrentUser();
  if (!user || user.status !== "ACTIVE") return null;
  return user;
}
