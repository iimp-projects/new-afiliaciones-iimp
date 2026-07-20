import type { Prisma } from "@prisma/client";

export const permissionsData: Prisma.PermissionCreateManyInput[] = [
  // ===========================================================================
  // DASHBOARD
  // ===========================================================================
  {
    action: "read",
    subject: "dashboard",
    description: "Visualizar el dashboard principal.",
  },

  // ===========================================================================
  // USERS
  // ===========================================================================
  { action: "create", subject: "users", description: "Crear usuarios." },
  { action: "read", subject: "users", description: "Consultar usuarios." },
  { action: "update", subject: "users", description: "Editar usuarios." },
  { action: "delete", subject: "users", description: "Eliminar usuarios." },
  { action: "restore", subject: "users", description: "Restaurar usuarios." },
  { action: "block", subject: "users", description: "Bloquear usuarios." },
  { action: "unlock", subject: "users", description: "Desbloquear usuarios." },
  { action: "assign-role", subject: "users", description: "Asignar roles." },

  // ===========================================================================
  // ROLES
  // ===========================================================================
  { action: "create", subject: "roles", description: "Crear roles." },
  { action: "read", subject: "roles", description: "Consultar roles." },
  { action: "update", subject: "roles", description: "Editar roles." },
  { action: "delete", subject: "roles", description: "Eliminar roles." },
  {
    action: "assign-permissions",
    subject: "roles",
    description: "Asignar permisos a un rol.",
  },

  // ===========================================================================
  // PERMISSIONS
  // ===========================================================================
  { action: "create", subject: "permissions", description: "Crear permisos." },
  { action: "read", subject: "permissions", description: "Consultar permisos." },
  { action: "update", subject: "permissions", description: "Editar permisos." },
  { action: "delete", subject: "permissions", description: "Eliminar permisos." },

  // ===========================================================================
  // APPLICATIONS
  // ===========================================================================
  { action: "create", subject: "applications", description: "Crear postulaciones." },
  { action: "read", subject: "applications", description: "Consultar postulaciones." },
  { action: "update", subject: "applications", description: "Editar postulaciones." },
  { action: "submit", subject: "applications", description: "Enviar postulaciones." },
  { action: "approve", subject: "applications", description: "Aprobar postulaciones." },
  { action: "reject", subject: "applications", description: "Rechazar postulaciones." },
  { action: "observe", subject: "applications", description: "Observar postulaciones." },
  { action: "assign", subject: "applications", description: "Asignar postulaciones." },
  { action: "archive", subject: "applications", description: "Archivar postulaciones." },
  { action: "reopen", subject: "applications", description: "Reabrir postulaciones." },
  { action: "export", subject: "applications", description: "Exportar postulaciones." },

  // ===========================================================================
  // DOCUMENTS
  // ===========================================================================
  { action: "upload", subject: "documents", description: "Subir documentos." },
  { action: "read", subject: "documents", description: "Consultar documentos." },
  { action: "update", subject: "documents", description: "Editar documentos." },
  { action: "delete", subject: "documents", description: "Eliminar documentos." },
  { action: "validate", subject: "documents", description: "Validar documentos." },
  { action: "approve", subject: "documents", description: "Aprobar documentos." },
  { action: "reject", subject: "documents", description: "Rechazar documentos." },
  { action: "download", subject: "documents", description: "Descargar documentos." },

  // ===========================================================================
  // PAYMENTS
  // ===========================================================================
  { action: "create", subject: "payments", description: "Registrar pagos." },
  { action: "read", subject: "payments", description: "Consultar pagos." },
  { action: "update", subject: "payments", description: "Editar pagos." },
  { action: "validate", subject: "payments", description: "Validar pagos." },
  { action: "refund", subject: "payments", description: "Reembolsar pagos." },
  { action: "cancel", subject: "payments", description: "Anular pagos." },
  { action: "export", subject: "payments", description: "Exportar pagos." },

  // ===========================================================================
  // MEMBERSHIPS
  // ===========================================================================
  { action: "create", subject: "memberships", description: "Crear membresías." },
  { action: "read", subject: "memberships", description: "Consultar membresías." },
  { action: "update", subject: "memberships", description: "Editar membresías." },
  { action: "approve", subject: "memberships", description: "Aprobar membresías." },
  { action: "suspend", subject: "memberships", description: "Suspender membresías." },
  { action: "reactivate", subject: "memberships", description: "Reactivar membresías." },

  // ===========================================================================
  // CATALOGS
  // ===========================================================================
  { action: "create", subject: "catalogs", description: "Crear catálogos." },
  { action: "read", subject: "catalogs", description: "Consultar catálogos." },
  { action: "update", subject: "catalogs", description: "Editar catálogos." },
  { action: "delete", subject: "catalogs", description: "Eliminar catálogos." },

  // ===========================================================================
  // REPORTS
  // ===========================================================================
  { action: "read", subject: "reports", description: "Consultar reportes." },
  { action: "export", subject: "reports", description: "Exportar reportes." },

  // ===========================================================================
  // AUDIT
  // ===========================================================================
  { action: "read", subject: "audit", description: "Consultar auditoría." },
  { action: "export", subject: "audit", description: "Exportar auditoría." },

  // ===========================================================================
  // NOTIFICATIONS
  // ===========================================================================
  { action: "send", subject: "notifications", description: "Enviar notificaciones." },
  { action: "read", subject: "notifications", description: "Consultar notificaciones." },

  // ===========================================================================
  // CONFIGURATION
  // ===========================================================================
  { action: "read", subject: "configuration", description: "Consultar configuración." },
  { action: "update", subject: "configuration", description: "Modificar configuración." },
];