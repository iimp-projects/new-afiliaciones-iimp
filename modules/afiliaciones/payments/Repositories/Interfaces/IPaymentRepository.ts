import type { ApplicationStatus, PaymentGateway, PaymentStatus, Prisma } from "@prisma/client";
import type { BillingDataInput } from "../../DTOs/billing.schema";
import type { BillingDocumentType, BillingReceiptType, BillingVerificationSource, BillingVerificationStatus } from "@prisma/client";

export interface BillingTraceability {
  documentType: BillingDocumentType;
  receiptType: BillingReceiptType;
  billingContact: string;
  verificationSource: BillingVerificationSource;
  verificationStatus: BillingVerificationStatus;
  verifiedBusinessName?: string;
  verifiedBillingAddress?: string;
  verifiedTaxStatus?: string;
  verifiedTaxCondition?: string;
  verifiedAt?: Date;
}
import type { NiubizCheckoutConfig } from "../../DTOs/Niubiz/NiubizCheckout.dto";
import type { AssociateSnapshotSource } from "../../../associates-integration/Services/AssociateIntegrationSnapshotBuilder";

export type PaymentTransaction = Prisma.TransactionClient;

export interface PaymentApplicationSnapshot {
  id: number;
  personId: number | null;
  status: ApplicationStatus;
  deletedAt: Date | null;
  email: string;
  phone: string;
  documentNumber: string;
  person: { firstName: string; paternalLastName: string } | null;
}

export interface PendingPaymentData {
  applicationId: number;
  registrationAmount: number;
  membershipFeeAmount: number;
  totalAmount: number;
  currency: "PEN";
  gateway: PaymentGateway;
  billingData: BillingDataInput;
  billingTraceability: BillingTraceability;
}

export interface PaymentGatewayResult {
  status: Extract<PaymentStatus, "PAID" | "FAILED" | "PENDING">;
  transactionId?: string;
  authorizationCode?: string;
  responseCode?: string;
  gatewayTransactionDate?: Date;
  cardBrand?: string;
  maskedCard?: string;
  paymentChannel?: string;
  failureCode?: string;
  failureReason?: string;
  gatewayErrorCode?: string;
  actionCode?: string;
  cardType?: string;
  traceNumber?: string;
  gatewayPayload?: Prisma.InputJsonValue;
  checkout?: NiubizCheckoutConfig;
}

export interface PersistedPayment {
  id: number;
  applicationId: number;
  totalAmount: number;
  registrationAmount?: number | null;
  membershipFeeAmount?: number | null;
  currency: "PEN";
  gateway: PaymentGateway;
  status: PaymentStatus;
}

export type ActivePaymentIntegrationSource = AssociateSnapshotSource & { applicationId: number; payment: { id: number; status: PaymentStatus; registrationAmount: number | null; membershipFeeAmount: number | null; totalAmount: number; currency: "PEN"; paymentDate: Date | null } };

export interface PaymentConfirmationDetails extends PersistedPayment {
  transactionId?: string;
  authorizationCode?: string;
  paymentDate?: Date;
  gatewayTransactionDate?: Date;
  cardBrand?: string;
  maskedCard?: string;
  paymentChannel?: string;
  failureCode?: string;
  failureReason?: string;
  gatewayErrorCode?: string;
  failureAt?: Date;
  actionCode?: string;
  cardType?: string;
  traceNumber?: string;
  confirmationEmailSentAt?: Date;
  application: {
    status: ApplicationStatus;
    applicationCode: string;
    trackingCode: string;
    draftData: Prisma.JsonValue | null;
    email: string;
    phone: string;
    documentType: string;
    documentNumber: string;
    affiliateType: string;
    submittedAt: Date | null;
    createdAt: Date;
    person: { firstName: string; paternalLastName: string; maternalLastName: string | null } | null;
  };
  billing: {
    taxId: string;
    businessName: string;
    billingAddress: string | null;
    billingEmail: string | null;
    documentType: BillingDocumentType | null;
    receiptType: BillingReceiptType | null;
    billingContact: string | null;
    verificationSource: BillingVerificationSource | null;
    verificationStatus: BillingVerificationStatus | null;
    verifiedBusinessName: string | null;
    verifiedBillingAddress: string | null;
    verifiedTaxStatus: string | null;
    verifiedTaxCondition: string | null;
    verifiedAt: Date | null;
    invoice: { type: string; serie: string; number: string; issueDate: Date; pdfUrl: string | null; xmlUrl: string | null; sunatCdrUrl: string | null } | null;
  } | null;
}

export interface IPaymentRepository {
  withTransaction<T>(callback: (tx: PaymentTransaction) => Promise<T>): Promise<T>;
  findApplicationById(applicationId: number, tx?: PaymentTransaction): Promise<PaymentApplicationSnapshot | null>;
  findActivePayment(applicationId: number, tx?: PaymentTransaction): Promise<PersistedPayment | null>;
  findPaymentByIdForApplication(paymentId: number, applicationId: number, tx?: PaymentTransaction): Promise<PersistedPayment | null>;
  claimPendingNiubizPayment(paymentId: number): Promise<PersistedPayment | null>;
  createPendingPayment(data: PendingPaymentData, tx?: PaymentTransaction): Promise<PersistedPayment>;
  updatePaymentResult(paymentId: number, result: PaymentGatewayResult, tx?: PaymentTransaction): Promise<PersistedPayment>;
  findActivePaymentIntegrationSource(paymentId: number, tx: PaymentTransaction): Promise<ActivePaymentIntegrationSource | null>;
  findPaymentConfirmationDetails(paymentId: number): Promise<PaymentConfirmationDetails | null>;
  markConfirmationEmailSent(paymentId: number): Promise<boolean>;
}
