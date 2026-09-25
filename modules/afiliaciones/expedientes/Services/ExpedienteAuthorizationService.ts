import type { CurrentUserDTO } from "@/modules/auth/context/types";

const ADMIN_ROLES = new Set(["SUPER_ADMIN", "SYSTEM_ADMIN"]);
const ROLE_DEPARTMENT: Readonly<Record<string, string>> = {
  LOGISTICA: "LOGISTICA",
  ATENCION_ASOCIADO: "ASOCIADOS",
  COMUNICACIONES: "COMUNICACIONES",
  LEGAL: "LEGAL",
  COMITE_EVALUADOR: "COMITE",
};
const DEPARTMENTS = new Set(Object.values(ROLE_DEPARTMENT));

export class ExpedienteAuthorizationService {
  public resolveWritableDepartment(user: CurrentUserDTO, requestedDepartment?: unknown): string {
    if (ADMIN_ROLES.has(user.role.slug)) {
      if (typeof requestedDepartment !== "string" || !DEPARTMENTS.has(requestedDepartment)) {
        throw new Error("Área de revisión inválida.");
      }
      return requestedDepartment;
    }

    const department = ROLE_DEPARTMENT[user.role.slug];
    if (!department) throw new Error("El rol actual no administra un área de expedientes.");
    if (requestedDepartment !== undefined && requestedDepartment !== department) {
      throw new Error("No puede modificar las validaciones de otra área.");
    }
    return department;
  }

  public assertCanWriteDepartment(user: CurrentUserDTO, department: string): void {
    if (ADMIN_ROLES.has(user.role.slug)) return;
    if (ROLE_DEPARTMENT[user.role.slug] !== department) {
      throw new Error("No puede modificar las validaciones de otra área.");
    }
  }
}

export const expedienteAuthorizationService = new ExpedienteAuthorizationService();

/**
 * Mapa de transiciones de estado permitidas vía el endpoint `/status`.
 * Cada transición exige la acción RBAC que representa la operación real
 * sobre la postulación (CAPABILITY), distinta del scope de área (SCOPE).
 */
const STATUS_PERMISSION_MAP: Readonly<Record<string, string>> = {
  OBSERVED: "observe",
  APPROVED: "approve",
  REJECTED: "reject",
  PENDING: "reopen",
};

/**
 * Resuelve el permiso requerido para una transición de estado de área.
 *
 * FAIL-CLOSED: devuelve `null` para `RESOLVED`, estados desconocidos o
 * entradas que no son strings. Nunca devuelve `"update"` como fallback.
 */
export function resolveRequiredApplicationPermission(targetStatus: unknown): string | null {
  if (typeof targetStatus !== "string") return null;
  return STATUS_PERMISSION_MAP[targetStatus] ?? null;
}
