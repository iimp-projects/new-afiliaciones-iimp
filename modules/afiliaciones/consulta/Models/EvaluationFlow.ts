import type { ApplicationStatusData, AreaStatusType } from "./ApplicationStatus";

export type StageState = "completed" | "active" | "upcoming";

export interface ParallelReview {
  key: "sponsors" | "associates" | "logistics";
  label: string;
  status: AreaStatusType;
  subtext?: string;
}

export interface EvaluationFlowState {
  isStudent: boolean;
  affiliateLabel: string;
  parallelReviews: ParallelReview[];
  stage1: StageState;
  stage2: StageState;
  stage3: StageState;
}

const AREA_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  UNDER_EVALUATION: "En evaluación",
  OBSERVED: "Observado",
  RESOLVED: "Subsanado",
  APPROVED: "Aprobado",
  REJECTED: "Rechazado",
  NOT_REQUIRED: "No aplica",
};

export function areaStatusLabel(status?: string): string {
  return AREA_STATUS_LABELS[status ?? "PENDING"] ?? "Pendiente";
}

export function areaStatusTone(status?: string): "success" | "warning" | "danger" | "neutral" {
  switch (status) {
    case "APPROVED":
      return "success";
    case "OBSERVED":
    case "REJECTED":
      return "danger";
    case "UNDER_EVALUATION":
    case "RESOLVED":
      return "warning";
    default:
      return "neutral";
  }
}

/**
 * Deriva el flujo de evaluación a partir de los datos reales de la postulación.
 * Los avales solo aplican a Asociado Activo; Asociado Estudiante no los tiene.
 */
export function deriveEvaluationFlow(data: ApplicationStatusData): EvaluationFlowState {
  const isStudent = data.affiliateType === "STUDENT";
  const areas = (data.areas ?? {}) as ApplicationStatusData["areas"];

  const sponsors = areas.sponsors ?? { status: "PENDING", approvedCount: 0, requiredCount: 2 };
  const associates = areas.associates ?? { status: "PENDING" };
  const logistics = areas.logistics ?? { status: "PENDING" };
  const board = areas.board ?? { status: "PENDING" };
  const payment = areas.payment ?? { status: "PENDING" };

  const sponsorsApproved = (sponsors.approvedCount ?? 0) >= (sponsors.requiredCount ?? 2);
  const sponsorsStatus: AreaStatusType = sponsorsApproved
    ? "APPROVED"
    : sponsors.status === "OBSERVED"
      ? "OBSERVED"
      : "PENDING";

  const parallelReviews: ParallelReview[] = isStudent
    ? [
        { key: "associates", label: "Área de Asociados", status: associates.status as AreaStatusType },
        { key: "logistics", label: "Área de Logística", status: logistics.status as AreaStatusType },
      ]
    : [
        {
          key: "sponsors",
          label: "Avales",
          status: sponsorsStatus,
          subtext: `${sponsors.approvedCount ?? 0} de ${sponsors.requiredCount ?? 2} revisados`,
        },
        { key: "associates", label: "Área de Asociados", status: associates.status as AreaStatusType },
        { key: "logistics", label: "Área de Logística", status: logistics.status as AreaStatusType },
      ];

  const stage1Completed = parallelReviews.every((review) => review.status === "APPROVED");
  const stage2Completed = board.status === "APPROVED";
  const stage3Completed = payment.status === "APPROVED" || data.status === "COMPLETED";

  let stage1: StageState;
  let stage2: StageState;
  let stage3: StageState;

  if (data.status === "COMPLETED" || stage3Completed) {
    stage1 = "completed";
    stage2 = "completed";
    stage3 = "completed";
  } else if (data.status === "READY_FOR_PAYMENT") {
    stage1 = "completed";
    stage2 = "completed";
    stage3 = "active";
  } else if (stage2Completed) {
    stage1 = "completed";
    stage2 = "completed";
    stage3 = "upcoming";
  } else if (stage1Completed) {
    stage1 = "completed";
    stage2 = "active";
    stage3 = "upcoming";
  } else {
    stage1 = "active";
    stage2 = "upcoming";
    stage3 = "upcoming";
  }

  return {
    isStudent,
    affiliateLabel: isStudent ? "Asociado Estudiante" : "Asociado Activo",
    parallelReviews,
    stage1,
    stage2,
    stage3,
  };
}

const SPANISH_MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export function formatRegistrationDate(iso?: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const day = String(date.getDate()).padStart(2, "0");
  return `${day} de ${SPANISH_MONTHS[date.getMonth()]} de ${date.getFullYear()}`;
}
