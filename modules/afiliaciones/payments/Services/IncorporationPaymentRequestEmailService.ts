import { readFile } from "node:fs/promises";
import path from "node:path";
import { AffiliateType, ApplicationStatus, PaymentStatus, TransactionalEmailStatus } from "@prisma/client";
import { MailService } from "@/modules/shared/Services/MailService";
import { documentTypeLabel } from "@/modules/shared/Utils/documentType";
import { TransactionalEmailRepository } from "@/modules/afiliaciones/notifications/Repositories/TransactionalEmailRepository";
import {
  IncorporationPaymentRequestRepository,
  type IncorporationPaymentRequestCandidate,
  type IncorporationPaymentRequestPayment,
} from "../Repositories/IncorporationPaymentRequestRepository";
import { PaymentAmountResolver } from "./PaymentAmountResolver";
import { PaymentSettingsResolver } from "@/modules/security/system-settings/Services/PaymentSettingsResolver";
import {
  buildIncorporationPaymentRequestEmail,
  INCORPORATION_PAYMENT_REQUEST_LOGO_CID,
  INCORPORATION_PAYMENT_REQUEST_QR_CID,
  INCORPORATION_PAYMENT_REQUEST_SUBJECT,
  type IncorporationPaymentRequestConcept,
} from "../Templates/IncorporationPaymentRequestTemplate";

export const INCORPORATION_PAYMENT_REQUEST_EVENT = "AFFILIATION_INCORPORATION_PAYMENT_REQUEST";
export const INCORPORATION_PAYMENT_REQUEST_TEMPLATE = "incorporation-payment-request";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const LOGO_PATH = path.join(process.cwd(), "public", "images", "logo-iimp.png");
const QR_PATH = path.join(process.cwd(), "public", "images", "iimp", "qr-yape-iimp.png");
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface IncorporationPaymentRequestAssets {
  logo: Buffer;
  qr: Buffer;
}

export interface IncorporationPaymentRequestSendResult {
  sent: boolean;
  reason?:
    | "NOT_FOUND"
    | "DELETED"
    | "NOT_READY_FOR_PAYMENT"
    | "STUDENT_EXEMPT"
    | "INVALID_EMAIL"
    | "ALREADY_PAID"
    | "NOTHING_TO_CHARGE"
    | "AMOUNTS_UNAVAILABLE"
    | "ASSETS_UNAVAILABLE"
    | "DUPLICATE"
    | "SEND_FAILED";
}

type MailSender = Pick<MailService, "sendMail">;
type AmountResolver = Pick<PaymentAmountResolver, "resolve">;
type FeePeriodResolver = Pick<PaymentSettingsResolver, "getMonthlyFeePeriod">;
type TransactionalEmailStore = Pick<
  TransactionalEmailRepository,
  "findByIdempotencyKey" | "createOrGetIdempotent" | "tryMarkSending" | "markAccepted" | "recordFailure"
>;

export interface IncorporationPaymentRequestEmailServiceOptions {
  repository?: Pick<IncorporationPaymentRequestRepository, "findCandidate">;
  mailService?: MailSender;
  amountResolver?: AmountResolver;
  feePeriodResolver?: FeePeriodResolver;
  transactionalEmails?: TransactionalEmailStore;
  assetsLoader?: () => Promise<IncorporationPaymentRequestAssets>;
}

async function readPng(filePath: string): Promise<Buffer> {
  const buffer = await readFile(filePath);
  if (buffer.length < PNG_SIGNATURE.length || !buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    throw new Error(`El archivo ${path.basename(filePath)} no es un PNG válido.`);
  }
  return buffer;
}

async function loadPaymentRequestAssets(): Promise<IncorporationPaymentRequestAssets> {
  const [logo, qr] = await Promise.all([readPng(LOGO_PATH), readPng(QR_PATH)]);
  return { logo, qr };
}

function fullNameOf(candidate: IncorporationPaymentRequestCandidate): string {
  if (!candidate.person) return "Postulante";
  return [candidate.person.firstName, candidate.person.paternalLastName, candidate.person.maternalLastName]
    .filter(Boolean)
    .join(" ")
    .trim() || "Postulante";
}

function paidConcepts(payments: IncorporationPaymentRequestPayment[]): { registration: boolean; membership: boolean } {
  const paid = payments.filter((payment) => payment.status === PaymentStatus.PAID);
  if (paid.length === 0) return { registration: false, membership: false };

  // Los pagos históricos sin desglose se consideran pagos completos.
  const withoutBreakdown = paid.some(
    (payment) => payment.registrationAmount === null && payment.membershipFeeAmount === null,
  );

  return {
    registration: withoutBreakdown || paid.some((payment) => (payment.registrationAmount ?? 0) > 0),
    membership: withoutBreakdown || paid.some((payment) => (payment.membershipFeeAmount ?? 0) > 0),
  };
}

function idempotencyKeyFor(applicationId: number): string {
  return `incorporation-payment-request:v1:${applicationId}`;
}

export class IncorporationPaymentRequestEmailService {
  private readonly repository: Pick<IncorporationPaymentRequestRepository, "findCandidate">;
  private readonly mailService: MailSender;
  private readonly amountResolver: AmountResolver;
  private readonly feePeriodResolver: FeePeriodResolver;
  private readonly transactionalEmails: TransactionalEmailStore;
  private readonly assetsLoader: () => Promise<IncorporationPaymentRequestAssets>;

  constructor(options: IncorporationPaymentRequestEmailServiceOptions = {}) {
    this.repository = options.repository ?? new IncorporationPaymentRequestRepository();
    this.mailService = options.mailService ?? new MailService();
    this.amountResolver = options.amountResolver ?? new PaymentAmountResolver();
    this.feePeriodResolver = options.feePeriodResolver ?? new PaymentSettingsResolver();
    this.transactionalEmails = options.transactionalEmails ?? new TransactionalEmailRepository();
    this.assetsLoader = options.assetsLoader ?? loadPaymentRequestAssets;
  }

  /**
   * Envía la solicitud de pago únicamente en la etapa previa a la activación:
   * expediente READY_FOR_PAYMENT, no estudiante, con conceptos pendientes y sin
   * un pago validado que ya los cubra. La idempotencia usa `sys_transactional_emails`.
   */
  async sendIfEligible(applicationId: number): Promise<IncorporationPaymentRequestSendResult> {
    const candidate = await this.repository.findCandidate(applicationId);
    if (!candidate) return { sent: false, reason: "NOT_FOUND" };
    if (candidate.deletedAt) return { sent: false, reason: "DELETED" };
    if (candidate.status !== ApplicationStatus.READY_FOR_PAYMENT) {
      return { sent: false, reason: "NOT_READY_FOR_PAYMENT" };
    }
    if (candidate.affiliateType === AffiliateType.STUDENT) return { sent: false, reason: "STUDENT_EXEMPT" };

    const recipient = candidate.email?.trim();
    if (!recipient || !EMAIL_PATTERN.test(recipient)) return { sent: false, reason: "INVALID_EMAIL" };

    const paid = paidConcepts(candidate.payments);
    if (paid.registration && paid.membership) return { sent: false, reason: "ALREADY_PAID" };

    let amounts: Awaited<ReturnType<AmountResolver["resolve"]>>;
    try {
      amounts = await this.amountResolver.resolve();
    } catch (error) {
      console.error("[INCORPORATION_PAYMENT_EMAIL] No se pudieron resolver los importes.", {
        applicationId,
        error: error instanceof Error ? error.message : "error desconocido",
      });
      return { sent: false, reason: "AMOUNTS_UNAVAILABLE" };
    }

    const concepts: IncorporationPaymentRequestConcept[] = [];
    if (!paid.registration && amounts.registrationAmount > 0) {
      concepts.push({ label: "Derecho de inscripción", amount: amounts.registrationAmount });
    }
    if (!paid.membership && amounts.membershipFeeAmount > 0) {
      concepts.push({ label: "Primera cuota anual de membresía", amount: amounts.membershipFeeAmount });
    }
    if (concepts.length === 0) return { sent: false, reason: "NOTHING_TO_CHARGE" };

    let membershipPeriod: string | null = null;
    if (!paid.membership) {
      try {
        const periodStart = await this.feePeriodResolver.getMonthlyFeePeriod();
        membershipPeriod = periodStart ? String(periodStart.getUTCFullYear()) : null;
      } catch {
        membershipPeriod = null;
      }
    }

    let assets: IncorporationPaymentRequestAssets;
    try {
      assets = await this.assetsLoader();
    } catch (error) {
      console.error("[INCORPORATION_PAYMENT_EMAIL] No se pudieron cargar los recursos del correo.", {
        applicationId,
        error: error instanceof Error ? error.message : "error desconocido",
      });
      return { sent: false, reason: "ASSETS_UNAVAILABLE" };
    }

    const idempotencyKey = idempotencyKeyFor(candidate.id);
    const existing = await this.transactionalEmails.findByIdempotencyKey(idempotencyKey);
    if (
      existing &&
      (existing.status === TransactionalEmailStatus.ACCEPTED ||
        existing.status === TransactionalEmailStatus.SENDING ||
        existing.status === TransactionalEmailStatus.EXHAUSTED)
    ) {
      return { sent: false, reason: "DUPLICATE" };
    }

    const { id } = await this.transactionalEmails.createOrGetIdempotent({
      event: INCORPORATION_PAYMENT_REQUEST_EVENT,
      templateName: INCORPORATION_PAYMENT_REQUEST_TEMPLATE,
      applicationId: candidate.id,
      recipient,
      idempotencyKey,
    });

    if (!(await this.transactionalEmails.tryMarkSending(id))) {
      return { sent: false, reason: "DUPLICATE" };
    }

    try {
      const html = buildIncorporationPaymentRequestEmail({
        fullName: fullNameOf(candidate),
        documentTypeLabel: documentTypeLabel(candidate.documentType),
        documentNumber: candidate.documentNumber,
        concepts,
        membershipPeriod,
      });

      const result = await this.mailService.sendMail({
        to: recipient,
        subject: INCORPORATION_PAYMENT_REQUEST_SUBJECT,
        html,
        fromName: "Instituto de Ingenieros de Minas del Perú – IIMP",
        replyTo: "asociados@iimp.org.pe",
        attachments: [
          {
            filename: "logo-iimp.png",
            content: assets.logo,
            contentType: "image/png",
            cid: INCORPORATION_PAYMENT_REQUEST_LOGO_CID,
            contentDisposition: "inline",
          },
          {
            filename: "qr-yape-iimp.png",
            content: assets.qr,
            contentType: "image/png",
            cid: INCORPORATION_PAYMENT_REQUEST_QR_CID,
            contentDisposition: "inline",
          },
        ],
      });

      await this.transactionalEmails.markAccepted(id, result.messageId);
      return { sent: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo enviar el correo.";
      await this.transactionalEmails.recordFailure(id, message, { exhausted: false });
      console.error("[INCORPORATION_PAYMENT_EMAIL] No se pudo enviar la solicitud de pago.", {
        applicationId: candidate.id,
        error: message,
      });
      return { sent: false, reason: "SEND_FAILED" };
    }
  }
}

/**
 * Dispara la solicitud de pago sin bloquear ni romper el flujo de aprobación.
 */
export async function notifyIncorporationPaymentRequest(applicationId: number): Promise<void> {
  try {
    await new IncorporationPaymentRequestEmailService().sendIfEligible(applicationId);
  } catch (error) {
    console.error("[INCORPORATION_PAYMENT_EMAIL] Error inesperado al procesar la solicitud de pago.", {
      applicationId,
      error: error instanceof Error ? error.message : "error desconocido",
    });
  }
}
