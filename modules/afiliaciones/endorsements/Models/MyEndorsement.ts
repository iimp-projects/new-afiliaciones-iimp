/**
 * "Mis avales" — vista de solo lectura del historial de avales que un asociado
 * autenticado otorgó a postulantes del IIMP.
 *
 * El aval vive en `MembershipApproval` (`sponsorPersonId` → `Person.id`). El
 * estado del aval (`EndorsementStatus`) es independiente del estado general del
 * expediente del solicitante (`ApplicationStatus`); este DTO expone ambos de
 * forma diferenciada.
 *
 * Este archivo es seguro para el cliente: no importa el runtime de Prisma, sólo
 * uniones de literales equivalentes a los enums.
 */

export type ApplicationStatusValue =
  | "DRAFT"
  | "PENDING"
  | "UNDER_EVALUACION"
  | "OBSERVED"
  | "RESOLVED"
  | "READY_FOR_PAYMENT"
  | "COMPLETED"
  | "REJECTED";

export type EndorsementStatusValue = "PENDING" | "APPROVED" | "REJECTED" | "INACTIVE";

export type EndorsementHistoryItem = {
  /** Id del registro de aval (MembershipApproval). */
  id: number;
  /** Nombre completo del solicitante (solo datos de presentación). */
  applicantName: string;
  /** Tipo de afiliación solicitada: ACTIVE/STUDENT. */
  affiliateType: string;
  /** Estado del aval otorgado por el asociado. */
  endorsementStatus: EndorsementStatusValue;
  /** Fecha en que el aval fue otorgado (ISO 8601). */
  endorsementDate: string;
  /** Estado general del expediente del solicitante. */
  applicationStatus: ApplicationStatusValue;
  /** Código del expediente del solicitante. */
  applicationCode: string;
};

export type EndorsementHistoryMetrics = {
  /** Total histórico de avales otorgados. */
  total: number;
  /** Solicitudes aprobadas (expediente aprobado o completado). */
  approved: number;
  /** Solicitudes en proceso (expediente aún en evaluación). */
  inProcess: number;
};

export type EndorsementHistoryFilters = {
  page: number;
  pageSize: number;
  search?: string;
  status?: ApplicationStatusValue;
  from?: Date;
  to?: Date;
};

export type EndorsementHistoryPage = {
  items: EndorsementHistoryItem[];
  metrics: EndorsementHistoryMetrics;
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

/**
 * Un expediente se considera "aprobado" cuando superó la evaluación
 * (listo para pago) o ya se completó. "En proceso" agrupa los estados previos
 * a la aprobación. Rechazado y borrador no entran en ningún indicador.
 */
export const APPROVED_APPLICATION_STATUSES: ApplicationStatusValue[] = [
  "READY_FOR_PAYMENT",
  "COMPLETED",
];

export const IN_PROCESS_APPLICATION_STATUSES: ApplicationStatusValue[] = [
  "PENDING",
  "UNDER_EVALUACION",
  "OBSERVED",
  "RESOLVED",
];

export const APPLICATION_STATUSES: ApplicationStatusValue[] = [
  "DRAFT",
  "PENDING",
  "UNDER_EVALUACION",
  "OBSERVED",
  "RESOLVED",
  "READY_FOR_PAYMENT",
  "COMPLETED",
  "REJECTED",
];

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatusValue, string> = {
  DRAFT: "Borrador",
  PENDING: "Pendiente",
  UNDER_EVALUACION: "En evaluación",
  OBSERVED: "Observada",
  RESOLVED: "Subsanación enviada",
  READY_FOR_PAYMENT: "Aprobada (lista para pago)",
  COMPLETED: "Completada",
  REJECTED: "Rechazada",
};

export const ENDORSEMENT_STATUS_LABELS: Record<EndorsementStatusValue, string> = {
  PENDING: "Pendiente de respuesta",
  APPROVED: "Aval aprobado",
  REJECTED: "Aval rechazado",
  INACTIVE: "Aval reemplazado",
};

export const AFFILIATE_TYPE_LABELS: Record<string, string> = {
  ACTIVE: "Asociado activo",
  STUDENT: "Asociado estudiante",
};
