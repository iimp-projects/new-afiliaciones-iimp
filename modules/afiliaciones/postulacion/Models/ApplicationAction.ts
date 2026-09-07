export const applicationStates = ["DRAFT", "PENDING", "UNDER_EVALUACION", "OBSERVED", "RESOLVED", "READY_FOR_PAYMENT", "COMPLETED", "REJECTED"] as const;
export type ApplicationState = typeof applicationStates[number];
export type ApplicationContext = "POSTULACION" | "CONSULTA";
export const currentApplicationStates: ApplicationState[] = ["DRAFT", "PENDING", "UNDER_EVALUACION", "OBSERVED", "RESOLVED", "READY_FOR_PAYMENT"];
export const blocksNewApplication = (status: string) => status !== "REJECTED";
export const canSubmitApplication = (status: string) => status === "DRAFT";
export const canEditApplication = (status: string) => status === "DRAFT" || status === "OBSERVED";

type Notice = { action: string; title: string; description: string; badge: string; label: string; tone: "INFO" | "ACTION_REQUIRED" | "SUCCESS" | "WARNING" | "FINAL" };
const matrix: Record<ApplicationState, { action: string; badge: string; tone: Notice["tone"]; post: [string, string, string]; query: [string, string, string] }> = {
  DRAFT: { action: "DRAFT_RECOVERY", badge: "Borrador", tone: "ACTION_REQUIRED", post: ["Tienes una postulación pendiente de completar", "Encontramos una solicitud que todavía no ha sido enviada. Puedes continuar desde donde la dejaste.", "Continuar postulación"], query: ["Tu postulación aún no ha sido enviada", "Encontramos una postulación en borrador. Todavía debes completar y enviar tu solicitud para que pueda iniciar el proceso de evaluación.", "Continuar mi postulación"] },
  PENDING: { action: "VIEW_STATUS", badge: "Pendiente", tone: "INFO", post: ["Ya tienes una postulación registrada", "Tu solicitud fue enviada correctamente y está pendiente de revisión.", "Consultar mi solicitud"], query: ["Solicitud recibida", "Tu postulación fue registrada correctamente y se encuentra pendiente de revisión.", "Consultar mi solicitud"] },
  UNDER_EVALUACION: { action: "VIEW_STATUS", badge: "En evaluación", tone: "INFO", post: ["Tu postulación está en evaluación", "Tu solicitud ya fue enviada y está siendo revisada por las áreas correspondientes.", "Consultar mi solicitud"], query: ["En evaluación", "Tu solicitud está siendo revisada por las áreas responsables. Aquí podrás ver el avance y cualquier novedad del proceso.", "Consultar mi solicitud"] },
  OBSERVED: { action: "REVIEW_OBSERVATIONS", badge: "Observada", tone: "ACTION_REQUIRED", post: ["Tu postulación tiene observaciones", "Tu solicitud ya fue evaluada y presenta observaciones pendientes de subsanar.", "Revisar observaciones"], query: ["Tienes observaciones pendientes", "Revisa las observaciones realizadas y corrige únicamente la información solicitada.", "Revisar y subsanar"] },
  RESOLVED: { action: "VIEW_STATUS", badge: "Subsanación enviada", tone: "INFO", post: ["Tus observaciones ya fueron subsanadas", "La información corregida fue enviada correctamente y tu solicitud se encuentra nuevamente en revisión.", "Consultar mi solicitud"], query: ["Subsanación enviada", "Tus observaciones fueron atendidas correctamente. La solicitud volvió al proceso de evaluación.", "Consultar mi solicitud"] },
  READY_FOR_PAYMENT: { action: "CONTINUE_PAYMENT", badge: "Lista para pago", tone: "SUCCESS", post: ["Tu postulación fue aprobada", "Tu solicitud completó satisfactoriamente la etapa de evaluación y está lista para continuar con el pago.", "Continuar con el pago"], query: ["Tu postulación fue aprobada", "Tu solicitud está lista para continuar con el pago.", "Continuar con el pago"] },
  COMPLETED: { action: "COMPLETED", badge: "Completada", tone: "FINAL", post: ["Tu proceso de afiliación ya fue completado", "Ya cuentas con una solicitud finalizada. Puedes revisar los detalles desde el módulo de seguimiento.", "Consultar solicitud"], query: ["Proceso completado", "Tu proceso de afiliación ha finalizado correctamente.", "Consultar solicitud"] },
  REJECTED: { action: "VIEW_REJECTION", badge: "Rechazada", tone: "WARNING", post: ["Tu postulación anterior fue rechazada", "Puedes consultar el resultado de tu solicitud.", "Consultar solicitud"], query: ["Postulación rechazada", "Tu solicitud anterior no fue aprobada.", "Consultar solicitud"] },
};
export function resolveApplicationAction(status: string | null, context: ApplicationContext, canStartNew = false): Notice {
  if (status === null) return { action: "START_NEW_APPLICATION", title: "No encontramos una solicitud registrada con los datos ingresados.", description: "Puedes iniciar una nueva postulación.", badge: "", label: "Iniciar postulación", tone: "INFO" };
  if (!Object.prototype.hasOwnProperty.call(matrix, status)) return { action: "UNKNOWN", title: "No pudimos determinar el estado actual de tu solicitud.", description: "Contacta al IIMP para revisar tu solicitud.", badge: "", label: "Cerrar", tone: "WARNING" };
  const entry = matrix[status as ApplicationState];
  const [title, description, label] = context === "POSTULACION" ? entry.post : entry.query;
  return { action: status === "REJECTED" && canStartNew ? "START_NEW_APPLICATION" : entry.action, title, description, label: status === "REJECTED" && canStartNew ? "Iniciar nueva postulación" : label, badge: entry.badge, tone: entry.tone };
}

export interface AuthorizedApplicationSummary {
  id: number; affiliateType: string; status: string; createdAt: string; canStartNew: boolean; recoveryUrl: string | null;
}
