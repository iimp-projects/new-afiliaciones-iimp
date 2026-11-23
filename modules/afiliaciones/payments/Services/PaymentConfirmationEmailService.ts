import { PaymentStatus, TransactionalEmailStatus } from "@prisma/client";
import { MailService } from "../../../shared/Services/MailService";
import type { IPaymentRepository } from "../Repositories/Interfaces/IPaymentRepository";
import { PaymentSettingsResolver } from "../../../security/system-settings/Services/PaymentSettingsResolver";
import { TransactionalEmailRepository } from "../../notifications/Repositories/TransactionalEmailRepository";
import { buildPaymentConfirmationEmail, buildPaymentIncidentEmail } from "../Templates/PaymentConfirmationEmailTemplate";

const CONFIRMATION_EVENT = "AFFILIATION_PAYMENT_CONFIRMATION";
const CONFIRMATION_TEMPLATE = "affiliation-payment-confirmation";
const INCIDENT_EVENT = "AFFILIATION_PAYMENT_INCIDENT";
const INCIDENT_TEMPLATE = "affiliation-payment-incident";
const PAYMENT_COPY_CC = ["asociados@iimp.org.pe"] as const;
const PAYMENT_COPY_BCC = ["john.moron@iimp.org.pe", "sistemas.iimp.ia@gmail.com"] as const;

function paymentCopyRecipients(to: string, billingEmail?: string | null): { cc?: string[]; bcc?: string[] } {
  if ((process.env.PAYMENT_ENVIRONMENT ?? "").trim().toUpperCase() !== "PRODUCTION") return {};
  const toKey = to.trim().toLowerCase();
  const unique = (values: string[]) => [...new Set(values.map((value) => value.trim().toLowerCase()).filter((value) => value && value !== toKey))];
  return {
    cc: unique([...PAYMENT_COPY_CC, billingEmail ?? ""]),
    bcc: unique([...PAYMENT_COPY_BCC]),
  };
}

export class PaymentConfirmationEmailService {
  private static readonly defaultSubject = "Afiliación IIMP confirmada – Pago realizado correctamente";
  private static readonly incidentSubject = "IIMP | Incidencia en el pago de tu afiliación";

  constructor(
    private readonly repository: Pick<IPaymentRepository, "findPaymentConfirmationDetails" | "markConfirmationEmailSent">,
    private readonly mailService = new MailService(),
    private readonly settings = new PaymentSettingsResolver(),
    private readonly transactionalEmails: Pick<
      TransactionalEmailRepository,
      "findByIdempotencyKey" | "createOrGetIdempotent" | "tryMarkSending" | "markAccepted" | "recordFailure"
    > = new TransactionalEmailRepository(),
  ) {}

  async sendIfNeeded(paymentId: number): Promise<void> {
    const payment = await this.repository.findPaymentConfirmationDetails(paymentId);
    if (!payment || payment.status !== PaymentStatus.PAID || payment.confirmationEmailSentAt) return;

    const recipient = payment.application.email?.trim();
    if (!recipient) return;

    const idempotencyKey = `affiliation-payment-confirmation:v1:${payment.id}`;
    const terminalStatuses: TransactionalEmailStatus[] = [TransactionalEmailStatus.ACCEPTED, TransactionalEmailStatus.SENDING, TransactionalEmailStatus.EXHAUSTED];
    let transactionalEmailId: number | undefined;
    try {
      const emailSettings = await this.settings.getPaymentConfirmationEmailSettings();
      if (!emailSettings.enabled) return;

      const existing = await this.transactionalEmails.findByIdempotencyKey(idempotencyKey);
      if (existing && terminalStatuses.includes(existing.status)) {
        await this.repository.markConfirmationEmailSent(payment.id);
        return;
      }

      const { id } = await this.transactionalEmails.createOrGetIdempotent({
        event: CONFIRMATION_EVENT,
        templateName: CONFIRMATION_TEMPLATE,
        applicationId: payment.applicationId,
        recipient,
        idempotencyKey,
      });
      transactionalEmailId = id;
      if (!(await this.transactionalEmails.tryMarkSending(id))) return;

      const copies = paymentCopyRecipients(recipient, payment.billing?.billingEmail);
      const result = await this.mailService.sendMail({
        to: recipient,
        ...copies,
        subject: emailSettings.subject ?? PaymentConfirmationEmailService.defaultSubject,
        html: buildPaymentConfirmationEmail(payment),
      });
      await this.transactionalEmails.markAccepted(id, result?.messageId);
      await this.repository.markConfirmationEmailSent(payment.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo enviar la confirmación.";
      if (transactionalEmailId !== undefined) {
        await this.transactionalEmails.recordFailure(transactionalEmailId, message).catch(() => undefined);
      }
      console.error("[PAYMENT_CONFIRMATION_EMAIL] No se pudo enviar la confirmación.", { paymentId });
    }
  }

  async resend(paymentId: number): Promise<void> {
    const payment = await this.repository.findPaymentConfirmationDetails(paymentId);
    if (!payment || payment.status !== PaymentStatus.PAID) throw new Error("No hay un pago aprobado para reenviar la confirmación.");
    const recipient = payment.application.email?.trim();
    if (!recipient) throw new Error("El expediente no tiene un correo válido para enviar la confirmación.");
    const emailSettings = await this.settings.getPaymentConfirmationEmailSettings();
    if (!emailSettings.enabled) throw new Error("El envío de confirmaciones de pago está deshabilitado.");
    const copies = paymentCopyRecipients(recipient, payment.billing?.billingEmail);
    await this.mailService.sendMail({
      to: recipient,
      ...copies,
      subject: emailSettings.subject ?? PaymentConfirmationEmailService.defaultSubject,
      html: buildPaymentConfirmationEmail(payment),
    });
    await this.repository.markConfirmationEmailSent(payment.id);
  }

  async sendIncidentIfNeeded(paymentId: number): Promise<void> {
    const payment = await this.repository.findPaymentConfirmationDetails(paymentId);
    if (!payment || payment.status !== PaymentStatus.FAILED) return;
    const recipient = payment.application.email?.trim();
    if (!recipient) return;

    const idempotencyKey = `affiliation-payment-incident:v1:${payment.id}`;
    let transactionalEmailId: number | undefined;
    try {
      const existing = await this.transactionalEmails.findByIdempotencyKey(idempotencyKey);
      const terminalStatuses: TransactionalEmailStatus[] = [TransactionalEmailStatus.ACCEPTED, TransactionalEmailStatus.SENDING, TransactionalEmailStatus.EXHAUSTED];
      if (existing && terminalStatuses.includes(existing.status)) return;

      const { id } = await this.transactionalEmails.createOrGetIdempotent({
        event: INCIDENT_EVENT,
        templateName: INCIDENT_TEMPLATE,
        applicationId: payment.applicationId,
        recipient,
        idempotencyKey,
      });
      transactionalEmailId = id;
      if (!(await this.transactionalEmails.tryMarkSending(id))) return;

      const copies = paymentCopyRecipients(recipient, payment.billing?.billingEmail);
      const result = await this.mailService.sendMail({
        to: recipient,
        ...copies,
        subject: PaymentConfirmationEmailService.incidentSubject,
        html: buildPaymentIncidentEmail(payment),
      });
      await this.transactionalEmails.markAccepted(id, result?.messageId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo enviar el correo de incidencia.";
      if (transactionalEmailId !== undefined) {
        await this.transactionalEmails.recordFailure(transactionalEmailId, message).catch(() => undefined);
      }
      console.error("[PAYMENT_INCIDENT_EMAIL] No se pudo enviar la incidencia.", { paymentId, errorName: error instanceof Error ? error.name : "UnknownError" });
    }
  }
}
