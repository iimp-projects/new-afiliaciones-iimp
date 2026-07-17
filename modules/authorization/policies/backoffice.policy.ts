import { RoleGuard, PermissionGuard } from "../guards";

export const BackofficePolicy = {
  /**
   * REGLA DE NEGOCIO: ¿Quién puede entrar al Backoffice?
   * 1. Evaluamos permisos (Futuro escalable y seguro).
   * 2. Evaluamos roles como fallback (Retrocompatibilidad inmediata).
   */
  canAccess(user: any): boolean {
    if (!user) return false;

    // Prioridad 1: Basado en permisos (PBAC)
    // Asumimos que crearemos un permiso {action: "access", subject: "backoffice"} en Prisma
    if (PermissionGuard.can(user, "access", "backoffice")) {
      return true;
    }

    // Prioridad 2: Fallback temporal basado en roles hardcodeados (RBAC Legacy)
    // Esto asegura que la app no se rompa hoy, y extrae el acoplamiento del middleware.
    const legacyStaffRoles = ["SUPER_ADMIN", "LOGISTICA", "LEGAL", "COMUNICACIONES"];
    
    return RoleGuard.hasAnyRole(user, legacyStaffRoles);
  }
};