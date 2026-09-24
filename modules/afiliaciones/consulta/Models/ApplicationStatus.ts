export type AreaStatusType = "PENDING" | "UNDER_EVALUATION" | "OBSERVED" | "RESOLVED" | "APPROVED" | "REJECTED" | "NOT_REQUIRED";
export type GlobalStatusType = "DRAFT" | "PENDING" | "UNDER_EVALUACION" | "OBSERVED" | "RESOLVED" | "READY_FOR_PAYMENT" | "COMPLETED" | "REJECTED";

export interface ConsultationQuery {
  documentType: string;
  documentNumber: string;
}

export interface AreaDetail {
  status: AreaStatusType;
  label?: string;
  observation?: string;
  evaluator?: string;
}

export interface ApplicationStatusData {
  canStartNew?: boolean;
  recoveryUrl?: string | null;
  id?: number | string;
  applicationId?: number;
  personId?: number | null;
  status: GlobalStatusType;
  applicationCode: string;
  trackingCode?: string;
  documentType?: string;
  documentNumber?: string;
  email?: string;
  phone?: string;
  applicantName?: string;
  affiliateType?: string;
  completedPayment?: {
    id: number;
    status: "PAID";
    amount: number;
    registrationAmount?: number | null;
    membershipFeeAmount?: number | null;
    currency: string;
    gateway: string;
    transactionId?: string | null;
    authorizationCode?: string | null;
    paymentDate?: string | Date | null;
    gatewayTransactionDate?: string | Date | null;
    cardBrand?: string | null;
    maskedCard?: string | null;
    cardType?: string | null;
    paymentChannel?: string | null;
    traceNumber?: string | null;
    billing?: { taxId: string; businessName: string; billingAddress?: string | null; billingEmail?: string | null; invoice?: { type: string; serie: string; number: string; issueDate: string | Date; pdfUrl?: string | null; xmlUrl?: string | null; sunatCdrUrl?: string | null } | null } | null;
  } | null;
  submissionDate?: string;
  updatedAt?: string;
  draftData?: any;
  pendingObservations?: Array<{ id: number; department: string; message: string; fieldPaths: string[] }>;
  observations?: string[];
  areas: {
    sponsors: AreaDetail & { approvedCount: number; requiredCount: number };
    associates: AreaDetail;
    logistics: AreaDetail;
    legal?: AreaDetail;
    board: AreaDetail;
    payment: AreaDetail;
  };
  totalAmount?: number;
  rejectionReason?: string;
}
