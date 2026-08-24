export type AreaStatusType = "PENDING" | "APPROVED" | "OBSERVED" | "REJECTED" | "NOT_REQUIRED";
export type GlobalStatusType = "SUBMITTED" | "IN_REVIEW" | "OBSERVED" | "APPROVED" | "REJECTED";

export interface ConsultationQuery {
  documentType: string;
  documentNumber: string;
  verificationCode: string;
}

export interface AreaDetail {
  status: AreaStatusType;
  label?: string;            // Ej: "1 de 2 Aprobados", "En espera"
  observation?: string;      // Detalle en caso de observación
  evaluator?: string;
}

export interface ApplicationStatusData {
  id?: number | string;           
  applicationId?: number | string;
  status: GlobalStatusType;
  applicationCode: string;
  applicantName?: string;
  submissionDate?: string;
  updatedAt?: string;

  // Evaluación detallada por áreas
  areas: {
    sponsors: AreaDetail & { approvedCount: number; requiredCount: number };
    associates: AreaDetail;
    logistics: AreaDetail;
    legal?: AreaDetail;      // Condicional: Solo si Logística observa
    board: AreaDetail;      // Directorio / Comité
    payment: AreaDetail;
  };

  // Datos adicionales para estados finales
  totalAmount?: number;
  rejectionReason?: string;
}