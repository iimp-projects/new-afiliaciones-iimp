export const NOTIFICATION_TYPES = {
  APPLICATION_SUBMITTED: "APPLICATION_SUBMITTED",
  CORRECTION_SUBMITTED: "CORRECTION_SUBMITTED",
} as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

export const NOTIFICATION_SEVERITIES = ["INFO", "WARNING", "CRITICAL"] as const;
export type NotificationSeverity = (typeof NOTIFICATION_SEVERITIES)[number];

export interface NotificationPresentation {
  label: string;
  description: string;
}

export const NOTIFICATION_CATALOG: Record<NotificationType, NotificationPresentation> = {
  APPLICATION_SUBMITTED: {
    label: "Nuevo expediente pendiente",
    description: "Se registró una nueva postulación que requiere revisión del área.",
  },
  CORRECTION_SUBMITTED: {
    label: "Subsanación recibida",
    description: "El postulante envió la subsanación solicitada y el área debe volver a revisar.",
  },
};

const FALLBACK_PRESENTATION: NotificationPresentation = { label: "Notificación", description: "" };

export function getNotificationPresentation(type: string | null | undefined): NotificationPresentation {
  if (!type) return FALLBACK_PRESENTATION;
  return NOTIFICATION_CATALOG[type as NotificationType] ?? { label: type, description: "" };
}

export const NOTIFICATION_SEVERITY_LABELS: Record<NotificationSeverity, string> = {
  INFO: "Informativa",
  WARNING: "Advertencia",
  CRITICAL: "Crítica",
};

export function getNotificationSeverityLabel(severity: string | null | undefined): string {
  if (!severity) return "Sin clasificar";
  return NOTIFICATION_SEVERITY_LABELS[severity as NotificationSeverity] ?? severity;
}
