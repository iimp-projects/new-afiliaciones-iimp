import type { PermissionString } from "../permissions";

/**
 * Evalúa si el usuario posee un permiso específico inyectado en su sesión
 */
export const PermissionGuard = {
  can(user: any, action: string, subject: string): boolean {
    if (!user || !Array.isArray(user.permissions)) return false;
    
    const targetPermission: PermissionString = `${action}:${subject}`;
    
    // Evalúa si tiene el permiso exacto o permiso global (wildcard)
    return user.permissions.includes(targetPermission) || 
           user.permissions.includes(`manage:all`);
  }
};