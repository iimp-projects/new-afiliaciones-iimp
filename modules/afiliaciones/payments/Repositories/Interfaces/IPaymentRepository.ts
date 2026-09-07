import type { ApplicationStatus, PaymentGateway, PaymentStatus, Prisma } from "@prisma/client";
import type { BillingDataInput } from "../../DTOs/billing.schema";
import type { NiubizCheckoutConfig } from "../../DTOs/Niubiz/NiubizCheckout.dto";

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
  amount: number;
  currency: "PEN";
  gateway: PaymentGateway;
  billingData: BillingDataInput;
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
  currency: "PEN";
  gateway: PaymentGateway;
  status: PaymentStatus;
}

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
    draftData: Prisma.JsonValue | null;
    email: string;
    phone: string;
    documentType: string;
    documentNumber: string;
    affiliateType: string;
    person: { firstName: string; paternalLastName: string; maternalLastName: string | null } | null;
  };
  billing: { taxId: string; businessName: string; billingAddress: string | null; billingEmail: string | null } | null;
}

export interface IPaymentRepository {
  withTransaction<T>(callback: (tx: PaymentTransaction) => Promise<T>): Promise<T>;
  findApplicationById(applicationId: number, tx?: PaymentTransaction): Promise<PaymentApplicationSnapshot | null>;
  findActivePayment(applicationId: number, tx?: PaymentTransaction): Promise<PersistedPayment | null>;
  findPaymentByIdForApplication(paymentId: number, applicationId: number, tx?: PaymentTransaction): Promise<PersistedPayment | null>;
  claimPendingNiubizPayment(paymentId: number): Promise<PersistedPayment | null>;
  createPendingPayment(data: PendingPaymentData, tx?: PaymentTransaction): Promise<PersistedPayment>;
  updatePaymentResult(paymentId: number, result: PaymentGatewayResult, tx?: PaymentTransaction): Promise<PersistedPayment>;
  findPaymentConfirmationDetails(paymentId: number): Promise<PaymentConfirmationDetails | null>;
  markConfirmationEmailSent(paymentId: number): Promise<boolean>;
}
