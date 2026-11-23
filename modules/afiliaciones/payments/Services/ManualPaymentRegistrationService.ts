import { ApplicationStatus, Currency, DocumentCategory, PaymentGateway, PaymentMethod, PaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { S3StorageService } from "@/modules/shared/Services/S3StorageService";
import { ApplicationStatusCalculatorService } from "@/modules/afiliaciones/postulacion/Services/ApplicationStatusCalculatorService";
import { AssociatesIntegrationService } from "@/modules/afiliaciones/associates-integration/Services/AssociatesIntegrationService";
import { AssociateProvisioningService } from "@/modules/afiliaciones/asociados/Services/AssociateProvisioningService";
import { PaymentRepository } from "../Repositories/PaymentRepository";
import { PaymentConfirmationEmailService } from "./PaymentConfirmationEmailService";
import { PaymentAmountResolver } from "./PaymentAmountResolver";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const ALLOWED_METHODS: PaymentMethod[] = [PaymentMethod.BANK_TRANSFER, PaymentMethod.CASH, PaymentMethod.UNKNOWN];

function matchesDeclaredType(buffer: Buffer, mimeType: string): boolean {
  if (mimeType === "application/pdf") return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
  if (mimeType === "image/jpeg") return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimeType === "image/png") return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mimeType === "image/webp") return buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  return false;
}

export class ManualPaymentError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export interface ManualPaymentProof {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface RegisterManualPaymentInput {
  applicationId: number;
  actorUserId: number;
  method: PaymentMethod;
  reference: string;
  comment: string | null;
  paidAt: Date;
  proof: ManualPaymentProof;
  ipAddress?: string;
  userAgent?: string;
}

export interface ManualPaymentResult {
  paymentId: number;
  applicationStatus: ApplicationStatus;
  warnings: string[];
}

export class ManualPaymentRegistrationService {
  constructor(
    private readonly amounts = new PaymentAmountResolver(),
    private readonly repository = new PaymentRepository(),
    private readonly calculator = new ApplicationStatusCalculatorService(),
    private readonly integration = new AssociatesIntegrationService(),
    private readonly provisioning = new AssociateProvisioningService(),
    private readonly confirmationEmail = new PaymentConfirmationEmailService(new PaymentRepository()),
    private readonly storage = new S3StorageService(),
  ) {}

  async getEligibility(applicationId: number) {
    const application = await prisma.membershipApplication.findUnique({
      where: { id: applicationId },
      select: { id: true, status: true, deletedAt: true },
    });
    if (!application || application.deletedAt) throw new ManualPaymentError("El expediente no existe.", 404);
    const paid = await prisma.payment.findFirst({ where: { applicationId, status: PaymentStatus.PAID }, select: { id: true } });
    const amounts = await this.amounts.resolve();
    return {
      eligible: application.status === ApplicationStatus.READY_FOR_PAYMENT && !paid,
      status: application.status,
      alreadyPaid: Boolean(paid),
      amounts,
    };
  }

  async register(input: RegisterManualPaymentInput): Promise<ManualPaymentResult> {
    if (!ALLOWED_METHODS.includes(input.method)) throw new ManualPaymentError("El medio de pago no es válido.", 400);
    const reference = input.reference.trim();
    if (reference.length < 3 || reference.length > 100) throw new ManualPaymentError("Ingrese un número de operación o referencia válido.", 400);
    if (input.comment && input.comment.length > 1000) throw new ManualPaymentError("El comentario no puede superar los 1000 caracteres.", 400);
    if (Number.isNaN(input.paidAt.getTime())) throw new ManualPaymentError("La fecha de pago no es válida.", 400);
    if (input.paidAt.getTime() > Date.now() + 5 * 60 * 1000) throw new ManualPaymentError("La fecha de pago no puede ser futura.", 400);
    if (input.proof.sizeBytes < 1 || input.proof.sizeBytes > MAX_BYTES) throw new ManualPaymentError("El comprobante debe pesar como máximo 10 MB.", 413);
    if (!ALLOWED_TYPES.includes(input.proof.mimeType)) throw new ManualPaymentError("El comprobante debe ser PDF, JPG, PNG o WEBP.", 415);
    if (!matchesDeclaredType(input.proof.buffer, input.proof.mimeType)) throw new ManualPaymentError("El contenido del comprobante no coincide con un formato permitido.", 415);

    const application = await prisma.membershipApplication.findUnique({
      where: { id: input.applicationId },
      select: { id: true, status: true, deletedAt: true },
    });
    if (!application || application.deletedAt) throw new ManualPaymentError("El expediente no existe.", 404);
    if (application.status !== ApplicationStatus.READY_FOR_PAYMENT) {
      throw new ManualPaymentError("Solo se puede registrar pago manual cuando el expediente está apto para pago.", 409);
    }

    const [existingPaid, duplicateReference, amounts] = await Promise.all([
      prisma.payment.findFirst({ where: { applicationId: input.applicationId, status: PaymentStatus.PAID }, select: { id: true } }),
      prisma.payment.findFirst({ where: { gateway: PaymentGateway.BANK_TRANSFER, transactionId: reference }, select: { id: true } }),
      this.amounts.resolve(),
    ]);
    if (existingPaid) throw new ManualPaymentError("El expediente ya tiene un pago registrado.", 409);
    if (duplicateReference) throw new ManualPaymentError("La referencia de pago ya fue registrada en otro expediente.", 409);

    const proofKey = await this.storage.uploadFile(
      input.proof.buffer,
      input.proof.fileName,
      input.proof.mimeType,
      `afiliaciones/applications/${input.applicationId}/documents`,
    );
    const warnings: string[] = [];
    let paymentId = 0;
    let integrationId: number | null = null;
    let applicationStatus: ApplicationStatus = application.status;

    await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          applicationId: input.applicationId,
          gateway: PaymentGateway.BANK_TRANSFER,
          transactionId: reference,
          totalAmount: new Prisma.Decimal(amounts.totalAmount),
          registrationAmount: new Prisma.Decimal(amounts.registrationAmount),
          membershipFeeAmount: new Prisma.Decimal(amounts.membershipFeeAmount),
          currency: Currency.PEN,
          status: PaymentStatus.PAID,
          paymentDate: input.paidAt,
          gatewayTransactionDate: input.paidAt,
          paymentChannel: "MANUAL",
          paymentMethod: input.method,
          gatewayPayload: {
            manualPayment: true,
            registeredBy: input.actorUserId,
            method: input.method,
            reference,
            comment: input.comment,
            paidAt: input.paidAt.toISOString(),
            proofFileUrl: proofKey,
          },
        },
        select: { id: true },
      });
      paymentId = payment.id;

      await tx.applicationDocument.create({
        data: {
          applicationId: input.applicationId,
          category: DocumentCategory.PAYMENT_VOUCHER,
          fileUrl: proofKey,
          fileName: input.proof.fileName,
          mimeType: input.proof.mimeType,
          sizeBytes: BigInt(input.proof.sizeBytes),
        },
      });

      applicationStatus = await this.calculator.recalculate(input.applicationId, tx, (preparedId) => { integrationId = preparedId; });
      if (applicationStatus !== ApplicationStatus.COMPLETED) {
        throw new ManualPaymentError("El expediente no cumple las condiciones para completarse.", 409);
      }

      if (integrationId === null) {
        try {
          const source = await this.repository.findActivePaymentIntegrationSource(payment.id, tx);
          const prepared = source ? await this.integration.prepareActivePayment(source, tx) : null;
          if (prepared) integrationId = prepared.id;
        } catch (error) {
          warnings.push("No se pudo preparar la integración con SIE; el pago quedó registrado y puede reintentarse.");
          console.error("[MANUAL_PAYMENT] No se pudo preparar integración SIE.", { applicationId: input.applicationId, errorName: error instanceof Error ? error.name : typeof error });
        }
      }

      await tx.auditLog.create({
        data: {
          userId: input.actorUserId,
          action: "MANUAL_PAYMENT_REGISTERED",
          entity: "Payment",
          entityId: String(payment.id),
          oldValues: { applicationStatus: application.status },
          newValues: {
            applicationStatus,
            applicationId: input.applicationId,
            amount: amounts.totalAmount,
            method: input.method,
            reference,
            comment: input.comment,
            proofFileUrl: proofKey,
          },
          ipAddress: input.ipAddress,
          userAgent: input.userAgent,
        },
      });
    });

    if (integrationId !== null) {
      try {
        await this.integration.processAfterCommit(integrationId);
      } catch {
        warnings.push("La integración con SIE quedó pendiente de procesamiento.");
      }
    }

    try {
      await this.provisioning.provisionCompletedApplication(input.applicationId);
    } catch (error) {
      warnings.push("El pago quedó registrado, pero no se pudo crear o activar la cuenta del asociado.");
      console.error("[MANUAL_PAYMENT] Falló el aprovisionamiento de cuenta.", { applicationId: input.applicationId, errorName: error instanceof Error ? error.name : typeof error });
    }

    try {
      await this.confirmationEmail.sendIfNeeded(paymentId);
    } catch {
      warnings.push("El pago quedó registrado, pero no se pudo enviar el correo de confirmación.");
    }

    return { paymentId, applicationStatus, warnings };
  }
}
