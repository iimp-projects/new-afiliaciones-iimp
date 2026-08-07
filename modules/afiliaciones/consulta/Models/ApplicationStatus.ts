export type StatusType = "IN_REVIEW" | "OBSERVED" | "APPROVED" | "REJECTED" | "SUBMITTED" ;

export interface ConsultationQuery {
  documentType: string;
  documentNumber: string;
  verificationCode: string; // applicationCode (ej. APP-1786118277804)
}

export interface ApplicationStatusData {
  status: StatusType;
  applicationCode: string;
  applicantName?: string;
  submissionDate?: string;
  // Campos para Observado
  observations?: string[];
  expirationDate?: string;
  // Campos para Aprobado
  membershipType?: string;
  period?: string;
  registrationFee?: number;
  annualFee?: number;
  totalAmount?: number;
  // Campos para Rechazado
  rejectionReason?: string;
  evaluationDate?: string;
}