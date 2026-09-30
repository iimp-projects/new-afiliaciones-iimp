import { EmailCampaignStatus, EmailSendStatus, Prisma } from "@prisma/client";
import { MailService, MailServiceError } from "@/modules/shared/Services/MailService";
import { ConfigurationError } from "@/lib/config/env";
import { renderTemplate, type TemplateRecipient } from "./TemplateRenderer";
import { isValidEmail } from "./Import/EmailProcessing";
import { CampaignRepository } from "../Repositories/CampaignRepository";
import { EmailDeliveryRepository } from "../Repositories/EmailDeliveryRepository";
import type { CampaignDetail } from "../Models/Campaign";

const SEND_IN_PROGRESS_MESSAGE = "Ya existe un envío en curso para este destinatario. Espera a que termine antes de intentarlo nuevamente.";
const INVALID_REPLY_TO_MESSAGE = "El correo Reply-To no tiene un formato válido.";
const SMTP_CONFIG_UNAVAILABLE_MESSAGE = "Configuración de correo no disponible.";
export const SMTP_CONFIG_UNAVAILABLE_CODE = "SMTP_CONFIGURATION_UNAVAILABLE";

export class CampaignMailError extends Error {
  constructor(message: string, readonly status = 400, readonly code?: string) {
    super(message);
    this.name = "CampaignMailError";
  }
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export type DeliverOutcome = "SENT" | "ERROR" | "SKIPPED";

export interface DeliverResult {
  outcome: DeliverOutcome;
  email: string;
  deliveryId?: number;
  attemptNumber?: number;
  priorSendCount?: number;
  messageId?: string;
  errorMessage?: string;
  skipReason?: "IN_FLIGHT" | "NOT_IN_CAMPAIGN" | "RECIPIENT_MISSING";
}

export class CampaignMailService {
  constructor(
    private readonly campaignRepository = new CampaignRepository(),
    private readonly deliveryRepository = new EmailDeliveryRepository(),
    private readonly mailService = new MailService("PROV"),
  ) {}

  async sendTest(campaignId: number, toEmail: string, referenceRecipientId: number | null, actor: { userId: number; email: string }): Promise<{ messageId?: string }> {
    if (!isValidEmail(toEmail.trim().toLowerCase())) throw new CampaignMailError("Correo destinatario inválido.", 422, "INVALID_TO_EMAIL");
    const campaign = await this.campaignRepository.getCampaign(campaignId);
    if (!campaign) throw new CampaignMailError("La campaña no existe.", 404);
    if (campaign.status === EmailCampaignStatus.CANCELLED) throw new CampaignMailError("La campaña está cancelada.", 409);
    this.assertReplyToValid(campaign.replyTo);

    let reference: TemplateRecipient = {};
    if (referenceRecipientId != null) {
      const membership = await this.deliveryRepository.getCampaignRecipient(campaignId, referenceRecipientId);
      if (!membership) throw new CampaignMailError("El destinatario de referencia no pertenece a la campaña.", 422);
      const recipient = await this.deliveryRepository.getRecipient(referenceRecipientId);
      if (recipient) reference = { name: recipient.name, company: recipient.company, position: recipient.position, email: recipient.email };
    }

    const subject = renderTemplate(campaign.subject, reference);
    const html = renderTemplate(campaign.htmlContent, reference);
    const text = campaign.textContent ? renderTemplate(campaign.textContent, reference) : undefined;

    const result = await this.deliver({ to: toEmail.trim(), subject, html, text, fromName: campaign.senderName ?? undefined, replyTo: campaign.replyTo ?? undefined });
    await this.deliveryRepository.writeAudit(actor, "EMAIL_TEST_SENT", { campaignId, testRecipient: toEmail.trim().toLowerCase(), referenceRecipientId: referenceRecipientId ?? null });
    return result;
  }

  async sendIndividual(campaignId: number, recipientId: number, actor: { userId: number; email: string }): Promise<{ messageId?: string }> {
    const campaign = await this.campaignRepository.getCampaign(campaignId);
    if (!campaign) throw new CampaignMailError("La campaña no existe.", 404);
    if (campaign.status !== EmailCampaignStatus.READY) throw new CampaignMailError("La campaña debe estar lista para enviar.", 409);
    this.assertReplyToValid(campaign.replyTo);

    const result = await this.deliverRecipient(campaign, campaignId, recipientId);

    if (result.outcome === "SKIPPED") {
      if (result.skipReason === "NOT_IN_CAMPAIGN") throw new CampaignMailError("El destinatario no pertenece a la campaña.", 404);
      if (result.skipReason === "RECIPIENT_MISSING") throw new CampaignMailError("El destinatario no existe.", 404);
      throw new CampaignMailError(SEND_IN_PROGRESS_MESSAGE, 409, "SEND_ALREADY_IN_PROGRESS");
    }

    if (result.outcome === "ERROR") {
      await this.deliveryRepository.writeAudit(actor, "EMAIL_FAILED", {
        campaignId, recipientId, email: result.email, deliveryId: result.deliveryId, attemptNumber: result.attemptNumber, result: "ERROR",
      });
      throw new CampaignMailError(result.errorMessage ?? "No se pudo enviar el correo.", 502);
    }

    await this.deliveryRepository.writeAudit(actor, (result.priorSendCount ?? 0) > 0 ? "EMAIL_RESENT" : "EMAIL_SENT", {
      campaignId, recipientId, email: result.email, deliveryId: result.deliveryId, attemptNumber: result.attemptNumber, result: "SENT",
    });
    return { messageId: result.messageId };
  }

  /**
   * Núcleo de entrega de un destinatario, compartido por el envío individual y
   * el envío masivo. Devuelve un resultado sin lanzar por fallo SMTP (registra
   * ERROR) ni por duplicado/en-vuelo (registra SKIPPED). Solo lanza ante errores
   * inesperados de infraestructura.
   */
  async deliverRecipient(campaign: CampaignDetail, campaignId: number, recipientId: number): Promise<DeliverResult> {
    const membership = await this.deliveryRepository.getCampaignRecipient(campaignId, recipientId);
    if (!membership) return { outcome: "SKIPPED", skipReason: "NOT_IN_CAMPAIGN", email: "" };

    const recipient = await this.deliveryRepository.getRecipient(recipientId);
    if (!recipient) return { outcome: "SKIPPED", skipReason: "RECIPIENT_MISSING", email: "" };

    await this.deliveryRepository.recoverStaleDeliveries(campaignId, recipientId);

    if (await this.deliveryRepository.hasInFlightDelivery(campaignId, recipientId)) {
      return { outcome: "SKIPPED", skipReason: "IN_FLIGHT", email: recipient.email, priorSendCount: membership.sendCount };
    }

    let delivery: { id: number; attemptNumber: number };
    try {
      delivery = await this.deliveryRepository.createPendingDelivery(campaignId, recipientId, recipient.email);
    } catch (error) {
      if (isUniqueViolation(error)) {
        return { outcome: "SKIPPED", skipReason: "IN_FLIGHT", email: recipient.email, priorSendCount: membership.sendCount };
      }
      throw error;
    }

    await this.deliveryRepository.markRecipientSending(campaignId, recipientId);

    const subject = renderTemplate(campaign.subject, recipient);
    const html = renderTemplate(campaign.htmlContent, recipient);
    const text = campaign.textContent ? renderTemplate(campaign.textContent, recipient) : undefined;

    try {
      const result = await this.deliver({ to: recipient.email, subject, html, text, fromName: campaign.senderName ?? undefined, replyTo: campaign.replyTo ?? undefined });
      await this.deliveryRepository.markDeliverySent(delivery.id, result.messageId);
      await this.deliveryRepository.markRecipientSent(campaignId, recipientId);
      return { outcome: "SENT", email: recipient.email, deliveryId: delivery.id, attemptNumber: delivery.attemptNumber, priorSendCount: membership.sendCount, messageId: result.messageId };
    } catch (error) {
      if (error instanceof CampaignMailError && error.code === SMTP_CONFIG_UNAVAILABLE_CODE) {
        await this.deliveryRepository.markDeliveryError(delivery.id, error.message);
        await this.deliveryRepository.markRecipientError(campaignId, recipientId);
        throw error;
      }
      const message = error instanceof MailServiceError || error instanceof CampaignMailError ? error.message : "No se pudo enviar el correo.";
      await this.deliveryRepository.markDeliveryError(delivery.id, message);
      await this.deliveryRepository.markRecipientError(campaignId, recipientId);
      return { outcome: "ERROR", email: recipient.email, deliveryId: delivery.id, attemptNumber: delivery.attemptNumber, priorSendCount: membership.sendCount, errorMessage: message };
    }
  }

  /**
   * Fail-fast de configuración: valida que la cuenta SMTP (PROV) tenga las
   * variables requeridas, sin abrir conexión. Lanza CampaignMailError con
   * SMTP_CONFIGURATION_UNAVAILABLE si falta configuración.
   */
  validateSendConfiguration(): void {
    try {
      this.mailService.validateConfiguration();
    } catch (error) {
      if (error instanceof ConfigurationError) {
        throw new CampaignMailError(SMTP_CONFIG_UNAVAILABLE_MESSAGE, 503, SMTP_CONFIG_UNAVAILABLE_CODE);
      }
      throw error;
    }
  }

  assertReplyToValid(replyTo: string | null | undefined): void {
    if (replyTo != null && replyTo.trim() !== "" && !isValidEmail(replyTo.trim())) {
      throw new CampaignMailError(INVALID_REPLY_TO_MESSAGE, 422, "INVALID_REPLY_TO");
    }
  }

  private async deliver(options: { to: string; subject: string; html: string; text?: string; fromName?: string; replyTo?: string }): Promise<{ messageId?: string }> {
    try {
      return await this.mailService.sendMail(options);
    } catch (error) {
      if (error instanceof ConfigurationError) throw new CampaignMailError(SMTP_CONFIG_UNAVAILABLE_MESSAGE, 503, SMTP_CONFIG_UNAVAILABLE_CODE);
      throw error;
    }
  }
}
