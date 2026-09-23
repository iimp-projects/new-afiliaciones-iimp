import type { OperationalAlertType } from "../Services/OperationalAlertsService";

export type OperationalAlertPresentation = { label: string; shortLabel: string; description: string };
export const OPERATIONAL_ALERT_CATALOG: Record<OperationalAlertType, OperationalAlertPresentation> = {
  PORTAL_ACCESS_CONFLICT: { label: "Conflicto de acceso al portal", shortLabel: "Conflicto de acceso", description: "Existe un conflicto de identidad o correo que impide habilitar el acceso al portal." },
  PORTAL_ACCESS_NOT_PROVISIONED: { label: "Acceso al portal no habilitado", shortLabel: "Acceso no habilitado", description: "La afiliación fue completada, pero el acceso al portal todavía no ha sido habilitado." },
  ACTIVATION_PENDING: { label: "Activación de cuenta pendiente", shortLabel: "Activación pendiente", description: "La cuenta fue creada, pero todavía no ha sido activada." },
  ACTIVATION_STALE: { label: "Activación de cuenta retrasada", shortLabel: "Activación retrasada", description: "La activación de la cuenta continúa pendiente por más de 24 horas." },
  SIE_SYNC_FAILED: { label: "Error de sincronización con SIE", shortLabel: "Error de SIE", description: "No fue posible completar la sincronización del asociado con SIE." },
  SIE_PENDING: { label: "Sincronización con SIE pendiente", shortLabel: "SIE pendiente", description: "La sincronización del asociado con SIE continúa pendiente." },
  PAYMENT_FAILURE: { label: "Error en el procesamiento del pago", shortLabel: "Error de pago", description: "El expediente registra un intento de pago que no pudo completarse correctamente." },
};
const fallback: OperationalAlertPresentation = { label: "Alerta operativa", shortLabel: "Alerta operativa", description: "Se detectó una incidencia que requiere revisión." };
export const getOperationalAlertPresentation = (type: string): OperationalAlertPresentation => OPERATIONAL_ALERT_CATALOG[type as OperationalAlertType] ?? fallback;
export const OPERATIONAL_ALERT_STATUS_LABELS: Record<string, string> = { ACTIVE: "Activa", IN_PROGRESS: "En seguimiento", RESOLVED: "Resuelta" };
export const OPERATIONAL_ALERT_SEVERITY_LABELS: Record<string, string> = { CRITICAL: "Crítica", WARNING: "Advertencia", INFO: "Informativa" };
export const getOperationalAlertStatusLabel = (status: string) => OPERATIONAL_ALERT_STATUS_LABELS[status] ?? "Estado no disponible";
export const getOperationalAlertSeverityLabel = (severity: string) => OPERATIONAL_ALERT_SEVERITY_LABELS[severity] ?? "Sin clasificar";
