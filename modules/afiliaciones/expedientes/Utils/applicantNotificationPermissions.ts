/**
 * Roles habilitados para ejecutar comunicaciones manuales desde el expediente:
 * notificar al Comité, enviar métodos de pago y reenviar al postulante.
 *
 * Es una política explícita de negocio (no un permiso RBAC genérico): aunque
 * otros roles tengan `update:applications`, estas acciones solo corresponden a
 * Atención al Asociado y a los administradores del sistema.
 */
export const APPLICANT_NOTIFICATION_ROLE_SLUGS = [
  "ATENCION_ASOCIADO",
  "SUPER_ADMIN",
  "SYSTEM_ADMIN",
] as const;

export type ApplicantNotificationRoleSlug = (typeof APPLICANT_NOTIFICATION_ROLE_SLUGS)[number];

export function canManageApplicantNotifications(roleSlug?: string | null): boolean {
  if (!roleSlug) return false;
  return (APPLICANT_NOTIFICATION_ROLE_SLUGS as readonly string[]).includes(roleSlug.trim().toUpperCase());
}
