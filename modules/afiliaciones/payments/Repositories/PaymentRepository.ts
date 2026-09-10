import { Currency, PaymentStatus, Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "../../../../lib/prisma";
import type {
  IPaymentRepository,
  PaymentApplicationSnapshot,
  ActivePaymentIntegrationSource,
  PaymentGatewayResult,
  PaymentTransaction,
  PendingPaymentData,
  PersistedPayment,
} from "./Interfaces/IPaymentRepository";
import type { IPaymentSandboxResetRepository, PaymentSandboxResetTransaction, SandboxResetPayment } from "./Interfaces/IPaymentSandboxResetRepository";

type PaymentDatabase = PrismaClient | PaymentTransaction;

export class PaymentRepository implements IPaymentRepository, IPaymentSandboxResetRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  withTransaction<T>(callback: (tx: PaymentTransaction) => Promise<T>): Promise<T> {
    return this.db.$transaction(callback);
  }

  async findApplicationById(applicationId: number, tx?: PaymentTransaction): Promise<PaymentApplicationSnapshot | null> {
    return this.client(tx).membershipApplication.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        personId: true,
        status: true,
        deletedAt: true,
        email: true,
        phone: true,
        documentNumber: true,
        person: { select: { firstName: true, paternalLastName: true } },
      },
    });
  }

  async findActivePayment(applicationId: number, tx?: PaymentTransaction): Promise<PersistedPayment | null> {
    const payment = await this.client(tx).payment.findFirst({
      where: {
        applicationId,
        status: { in: [PaymentStatus.PENDING, PaymentStatus.PROCESSING] },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, applicationId: true, totalAmount: true, registrationAmount: true, membershipFeeAmount: true, currency: true, gateway: true, status: true },
    });

    return payment ? this.toPersistedPayment(payment) : null;
  }

  async findPaymentByIdForApplication(paymentId: number, applicationId: number, tx?: PaymentTransaction): Promise<PersistedPayment | null> {
    const payment = await this.client(tx).payment.findFirst({
      where: { id: paymentId, applicationId },
      select: { id: true, applicationId: true, totalAmount: true, registrationAmount: true, membershipFeeAmount: true, currency: true, gateway: true, status: true },
    });

    return payment ? this.toPersistedPayment(payment) : null;
  }

  async claimPendingNiubizPayment(paymentId: number): Promise<PersistedPayment | null> {
    const claimed = await this.db.payment.updateMany({
      where: { id: paymentId, gateway: "NIUBIZ", status: PaymentStatus.PENDING },
      data: { status: PaymentStatus.PROCESSING },
    });
    if (claimed.count !== 1) return null;

    const payment = await this.db.payment.findUnique({
      where: { id: paymentId },
      select: { id: true, applicationId: true, totalAmount: true, registrationAmount: true, membershipFeeAmount: true, currency: true, gateway: true, status: true },
    });
    return payment ? this.toPersistedPayment(payment) : null;
  }

  async createPendingPayment(data: PendingPaymentData, tx?: PaymentTransaction): Promise<PersistedPayment> {
    const payment = await this.client(tx).payment.create({
      data: {
        applicationId: data.applicationId,
        gateway: data.gateway,
        totalAmount: new Prisma.Decimal(data.totalAmount),
        registrationAmount: new Prisma.Decimal(data.registrationAmount),
        membershipFeeAmount: new Prisma.Decimal(data.membershipFeeAmount),
        currency: Currency.PEN,
        status: PaymentStatus.PENDING,
        billing: {
          create: {
            taxId: data.billingData.numeroDocumento,
            businessName: data.billingData.razonSocial,
            billingAddress: data.billingData.direccionFiscal,
            billingEmail: data.billingData.emailFacturacion,
            documentType: data.billingTraceability.documentType,
            receiptType: data.billingTraceability.receiptType,
            billingContact: data.billingTraceability.billingContact,
            verificationSource: data.billingTraceability.verificationSource,
            verificationStatus: data.billingTraceability.verificationStatus,
            verifiedBusinessName: data.billingTraceability.verifiedBusinessName,
            verifiedBillingAddress: data.billingTraceability.verifiedBillingAddress,
            verifiedTaxStatus: data.billingTraceability.verifiedTaxStatus,
            verifiedTaxCondition: data.billingTraceability.verifiedTaxCondition,
            verifiedAt: data.billingTraceability.verifiedAt,
          },
        },
      },
      select: { id: true, applicationId: true, totalAmount: true, registrationAmount: true, membershipFeeAmount: true, currency: true, gateway: true, status: true },
    });

    return this.toPersistedPayment(payment);
  }

  async updatePaymentResult(paymentId: number, result: PaymentGatewayResult, tx?: PaymentTransaction): Promise<PersistedPayment> {
    const payment = await this.client(tx).payment.update({
      where: { id: paymentId },
      data: {
        status: result.status,
        transactionId: result.transactionId,
        authorizationCode: result.authorizationCode,
        responseCode: result.responseCode,
        gatewayTransactionDate: result.gatewayTransactionDate,
        cardBrand: result.cardBrand,
        maskedCard: result.maskedCard,
        paymentChannel: result.paymentChannel,
        failureCode: result.status === PaymentStatus.FAILED ? result.failureCode : null,
        failureReason: result.status === PaymentStatus.FAILED ? result.failureReason : null,
        gatewayErrorCode: result.status === PaymentStatus.FAILED ? result.gatewayErrorCode : null,
        failureAt: result.status === PaymentStatus.FAILED ? new Date() : null,
        actionCode: result.actionCode,
        cardType: result.cardType,
        traceNumber: result.traceNumber,
        gatewayPayload: result.gatewayPayload,
        paymentDate: result.status === PaymentStatus.PAID ? new Date() : null,
      },
      select: { id: true, applicationId: true, totalAmount: true, registrationAmount: true, membershipFeeAmount: true, currency: true, gateway: true, status: true },
    });

    return this.toPersistedPayment(payment);
  }

  async findActivePaymentIntegrationSource(paymentId: number, tx: PaymentTransaction): Promise<ActivePaymentIntegrationSource | null> {
    const payment = await this.client(tx).payment.findUnique({ where: { id: paymentId }, select: {
      id: true, applicationId: true, status: true, registrationAmount: true, membershipFeeAmount: true, totalAmount: true, currency: true, paymentDate: true,
      billing: { select: { taxId: true, businessName: true, billingAddress: true, billingEmail: true, documentType: true, receiptType: true, billingContact: true } },
      application: { select: { affiliateType: true, documentType: true, documentNumber: true, email: true, phone: true, person: { select: { firstName: true, paternalLastName: true, maternalLastName: true, gender: true, addresses: { select: { street: true, isPrimary: true } } } } } },
    } });
    if (!payment || payment.application.affiliateType !== "ACTIVE") return null;
    return { applicationId: payment.applicationId, documentType: payment.application.documentType, documentNumber: payment.application.documentNumber, email: payment.application.email, phone: payment.application.phone, person: payment.application.person, billing: payment.billing, payment: { id: payment.id, status: payment.status, registrationAmount: payment.registrationAmount?.toNumber() ?? null, membershipFeeAmount: payment.membershipFeeAmount?.toNumber() ?? null, totalAmount: payment.totalAmount.toNumber(), currency: payment.currency as "PEN", paymentDate: payment.paymentDate } };
  }

  async findPaymentConfirmationDetails(paymentId: number): Promise<import("./Interfaces/IPaymentRepository").PaymentConfirmationDetails | null> {
    const payment = await this.db.payment.findUnique({
      where: { id: paymentId },
      include: {
        billing: { select: { taxId: true, businessName: true, billingAddress: true, billingEmail: true, documentType: true, receiptType: true, billingContact: true, verificationSource: true, verificationStatus: true, verifiedBusinessName: true, verifiedBillingAddress: true, verifiedTaxStatus: true, verifiedTaxCondition: true, verifiedAt: true, invoice: { select: { type: true, serie: true, number: true, issueDate: true, pdfUrl: true, xmlUrl: true, sunatCdrUrl: true } } } },
        application: {
          select: {
            status: true, applicationCode: true, trackingCode: true, draftData: true, email: true, phone: true, documentType: true, documentNumber: true, affiliateType: true, submittedAt: true, createdAt: true,
            person: { select: { firstName: true, paternalLastName: true, maternalLastName: true } },
          },
        },
      },
    });
    if (!payment) return null;
    return {
      ...this.toPersistedPayment(payment),
      ...(payment.transactionId ? { transactionId: payment.transactionId } : {}),
      ...(payment.authorizationCode ? { authorizationCode: payment.authorizationCode } : {}),
      ...(payment.paymentDate ? { paymentDate: payment.paymentDate } : {}),
      ...(payment.gatewayTransactionDate ? { gatewayTransactionDate: payment.gatewayTransactionDate } : {}),
      ...(payment.cardBrand ? { cardBrand: payment.cardBrand } : {}),
      ...(payment.maskedCard ? { maskedCard: payment.maskedCard } : {}),
      ...(payment.paymentChannel ? { paymentChannel: payment.paymentChannel } : {}),
      ...(payment.failureCode ? { failureCode: payment.failureCode } : {}),
      ...(payment.failureReason ? { failureReason: payment.failureReason } : {}),
      ...(payment.gatewayErrorCode ? { gatewayErrorCode: payment.gatewayErrorCode } : {}),
      ...(payment.failureAt ? { failureAt: payment.failureAt } : {}),
      ...(payment.actionCode ? { actionCode: payment.actionCode } : {}),
      ...(payment.cardType ? { cardType: payment.cardType } : {}),
      ...(payment.traceNumber ? { traceNumber: payment.traceNumber } : {}),
      ...(payment.confirmationEmailSentAt ? { confirmationEmailSentAt: payment.confirmationEmailSentAt } : {}),
      application: payment.application,
      billing: payment.billing,
    };
  }

  async markConfirmationEmailSent(paymentId: number): Promise<boolean> {
    const updated = await this.db.payment.updateMany({
      where: { id: paymentId, confirmationEmailSentAt: null, status: PaymentStatus.PAID },
      data: { confirmationEmailSentAt: new Date() },
    });
    return updated.count === 1;
  }

  async findPaymentForSandboxReset(paymentId: number, tx: PaymentSandboxResetTransaction): Promise<SandboxResetPayment | null> {
    const payment = await this.client(tx).payment.findUnique({
      where: { id: paymentId },
      select: {
        id: true,
        applicationId: true,
        gateway: true,
        status: true,
        billing: { select: { invoice: { select: { id: true } } } },
      },
    });
    if (!payment) return null;
    return {
      id: payment.id,
      applicationId: payment.applicationId,
      gateway: payment.gateway,
      status: payment.status,
      hasInvoice: payment.billing?.invoice !== null && payment.billing?.invoice !== undefined,
    };
  }

  async resetSandboxPayment(paymentId: number, tx: PaymentSandboxResetTransaction): Promise<void> {
    await this.client(tx).payment.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.PENDING,
        transactionId: null,
        authorizationCode: null,
        responseCode: null,
        paymentDate: null,
        gatewayTransactionDate: null,
        cardBrand: null,
        maskedCard: null,
        paymentChannel: null,
        actionCode: null,
        cardType: null,
        traceNumber: null,
        failureCode: null,
        failureReason: null,
        gatewayErrorCode: null,
        failureAt: null,
        confirmationEmailSentAt: null,
        gatewayPayload: Prisma.DbNull,
      },
    });
  }

  async createSandboxResetAudit(data: { userId: number; paymentId: number; applicationId: number; previousStatus: PaymentStatus; ipAddress?: string; userAgent?: string }, tx: PaymentSandboxResetTransaction): Promise<void> {
    await this.client(tx).auditLog.create({
      data: {
        userId: data.userId,
        action: "SANDBOX_PAYMENT_RESET",
        entity: "Payment",
        entityId: String(data.paymentId),
        oldValues: { status: data.previousStatus },
        newValues: { status: PaymentStatus.PENDING, applicationId: data.applicationId },
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
    });
  }

  private client(tx?: PaymentTransaction): PaymentDatabase {
    return tx ?? this.db;
  }

  private toPersistedPayment(payment: {
    id: number;
    applicationId: number;
    totalAmount: Prisma.Decimal;
    registrationAmount: Prisma.Decimal | null;
    membershipFeeAmount: Prisma.Decimal | null;
    currency: Currency;
    gateway: import("@prisma/client").PaymentGateway;
    status: PaymentStatus;
  }): PersistedPayment {
    return {
      id: payment.id,
      applicationId: payment.applicationId,
      totalAmount: payment.totalAmount.toNumber(),
      registrationAmount: payment.registrationAmount?.toNumber() ?? null,
      membershipFeeAmount: payment.membershipFeeAmount?.toNumber() ?? null,
      currency: payment.currency as "PEN",
      gateway: payment.gateway,
      status: payment.status,
    };
  }
}
