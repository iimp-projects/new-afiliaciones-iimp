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
