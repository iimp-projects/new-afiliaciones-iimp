import type { PaymentGateway, PaymentStatus, Prisma } from "@prisma/client";

export type PaymentSandboxResetTransaction = Prisma.TransactionClient;

export interface SandboxResetPayment {
  id: number;
  applicationId: number;
  gateway: PaymentGateway;
  status: PaymentStatus;
  hasInvoice: boolean;
}

export interface IPaymentSandboxResetRepository {
  withTransaction<T>(callback: (tx: PaymentSandboxResetTransaction) => Promise<T>): Promise<T>;
  findPaymentForSandboxReset(paymentId: number, tx: PaymentSandboxResetTransaction): Promise<SandboxResetPayment | null>;
  resetSandboxPayment(paymentId: number, tx: PaymentSandboxResetTransaction): Promise<void>;
  createSandboxResetAudit(data: {
    userId: number;
    paymentId: number;
    applicationId: number;
    previousStatus: PaymentStatus;
    ipAddress?: string;
    userAgent?: string;
  }, tx: PaymentSandboxResetTransaction): Promise<void>;
}
