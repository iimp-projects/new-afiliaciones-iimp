/**
 * Evalúa puramente mecánicas de roles basadas en el token de sesión
 */
export const RoleGuard = {
  hasRole(user: any, role: string): boolean {
    if (!user || !user.role) return false;
    return user.role === role;
  },

  hasAnyRole(user: any, roles: string[]): boolean {
    if (!user || !user.role) return false;
    return roles.includes(user.role);
  }
};