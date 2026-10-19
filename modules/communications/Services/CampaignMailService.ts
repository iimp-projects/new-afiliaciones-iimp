import { EmailCampaignStatus, Prisma, UserStatus } from "@prisma/client";
import { MailService, MailServiceError } from "@/modules/shared/Services/MailService";
import { ConfigurationError, getAppBaseUrl } from "@/lib/config/env";
import { accountActivationService } from "@/modules/auth/account-activation/service";
import { escapeHtml } from "@/modules/shared/Email/EmailEscaping";
import { renderTemplate, type TemplateRecipient } from "./TemplateRenderer";
import { isValidEmail } from "./Import/EmailProcessing";
import { CampaignRepository } from "../Repositories/CampaignRepository";
import { EmailDeliveryRepository } from "../Repositories/EmailDeliveryRepository";
import { AssociateRecipientRepository } from "../Repositories/AssociateRecipientRepository";
import { toAssociateRecipientLink, tipoAsociadoLabel } from "../Models/AssociateRecipient";
import type { AssociateRecipientMetadata } from "../Models/AssociateRecipient";
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

function toAssociateMetadata(metadata: Prisma.JsonValue | null | undefined): AssociateRecipientMetadata | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = metadata as Record<string, unknown>;
  if (value.source !== "associates" || typeof value.userId !== "number" || typeof value.correoAcceso !== "string") return null;
  return value as unknown as AssociateRecipientMetadata;
}

const REQUIRED_ASSOCIATE_VARIABLES = ["nombre_completo", "correo_acceso"] as const;

function usesTemplateVariable(templates: Array<string | null | undefined>, variable: string): boolean {
  const pattern = new RegExp(`\\{\\{#?${variable}\\}\\}`);
  return templates.some((template) => template != null && pattern.test(template));
}

function requiredVariableValue(context: TemplateRecipient, variable: string): string | null | undefined {
  if (variable === "nombre_completo") return context.nombreCompleto;
  if (variable === "correo_acceso") return context.correoAcceso;
  return undefined;
}

/**
 * Devuelve el nombre de la primera variable obligatoria de asociado usada por la
 * plantilla cuyo valor resuelto está vacío, o null si todas están completas.
 */
function findMissingRequiredVariable(templates: Array<string | null | undefined>, context: TemplateRecipient): string | null {
  for (const variable of REQUIRED_ASSOCIATE_VARIABLES) {
    if (!usesTemplateVariable(templates, variable)) continue;
    const value = requiredVariableValue(context, variable);
    if (value == null || value.trim() === "") return variable;
  }
  return null;
}

export type DeliverOutcome = "SENT" | "ERROR" | "SKIPPED" | "RATE_LIMITED" | "QUOTA_EXCEEDED";

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

type AssociateResolution =
  | { excluded: true; reason: string }
  | { excluded: false; context: TemplateRecipient | null; pendingActivationUserId: number | null };

export class CampaignMailService {
  constructor(
    private readonly campaignRepository = new CampaignRepository(),
    private readonly deliveryRepository = new EmailDeliveryRepository(),
    private readonly mailService = new MailService(),
    private readonly associateRepository = new AssociateRecipientRepository(),
    private readonly accountActivation = accountActivationService,
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
      if (recipient) {
        reference = { name: recipient.name, company: recipient.company, position: recipient.position, email: recipient.email };
        const associate = await this.resolveAssociateContext(membership.metadata, recipient.metadata);
        if (associate.excluded) throw new CampaignMailError(associate.reason, 422, "REFERENCE_ASSOCIATE_EXCLUDED");
        if (associate.context) {
          // La prueba no mintea tokens reales: {{enlace_activacion}} queda vacío
          // para no generar, consumir ni invalidar tokens de activación.
          reference = { ...reference, ...associate.context };
        }
      }
    }

    const missingVariable = findMissingRequiredVariable([campaign.subject, campaign.htmlContent, campaign.textContent ?? undefined], reference);
    if (missingVariable) {
      throw new CampaignMailError(`No se puede enviar la prueba: la variable obligatoria "{{${missingVariable}}}" no tiene valor para el destinatario de referencia.`, 422, "MISSING_REQUIRED_VARIABLE");
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

    // Reserva atómica y persistente: PENDING → SENDING + delivery en la misma
    // transacción. Evita que dos workers procesen el mismo destinatario y garantiza
    // que un envío interrumpido siempre tenga delivery para la recuperación.
    const claim = await this.deliveryRepository.claimRecipient(campaignId, recipientId, recipient.email);
    if (!claim.claimed || !claim.delivery) {
      return { outcome: "SKIPPED", skipReason: "IN_FLIGHT", email: recipient.email, priorSendCount: membership.sendCount };
    }
    const delivery = claim.delivery;

    // Revalidación del origen "Asociados del sistema" justo antes de enviar.
    // Protege frente a cambios de correo/estado posteriores a la preparación y
    // resuelve {{correo_acceso}} desde la fuente de autenticación verificada.
    // Si el snapshot de campaña es NULL, se resuelve por `userId` desde
    // EmailRecipient.metadata para no perder la vinculación del asociado.
    const associate = await this.resolveAssociateContext(membership.metadata, recipient.metadata);
    if (associate.excluded) {
      await this.deliveryRepository.excludeClaimedDelivery(delivery.id, campaignId, recipientId, associate.reason);
      return { outcome: "ERROR", email: recipient.email, deliveryId: delivery.id, attemptNumber: delivery.attemptNumber, priorSendCount: membership.sendCount, errorMessage: associate.reason };
    }

    // Sin redirigir en silencio: si el correo de acceso resuelto difiere del
    // correo del destinatario preparado, se excluye en lugar de reenviar a otro.
    if (associate.context?.email != null && associate.context.email.trim().toLowerCase() !== recipient.email.trim().toLowerCase()) {
      const reason = "El correo de acceso cambió después de preparar la campaña.";
      await this.deliveryRepository.excludeClaimedDelivery(delivery.id, campaignId, recipientId, reason);
      return { outcome: "ERROR", email: recipient.email, deliveryId: delivery.id, attemptNumber: delivery.attemptNumber, priorSendCount: membership.sendCount, errorMessage: reason };
    }

    const genericContext: TemplateRecipient = { name: recipient.name, company: recipient.company, position: recipient.position, email: recipient.email };
    let context: TemplateRecipient = associate.context ? { ...genericContext, ...associate.context } : genericContext;

    const missingVariable = findMissingRequiredVariable([campaign.subject, campaign.htmlContent, campaign.textContent ?? undefined], context);
    if (missingVariable) {
      const reason = `No se puede enviar: la variable obligatoria "{{${missingVariable}}}" no tiene valor para este destinatario.`;
      await this.deliveryRepository.excludeClaimedDelivery(delivery.id, campaignId, recipientId, reason);
      return { outcome: "ERROR", email: recipient.email, deliveryId: delivery.id, attemptNumber: delivery.attemptNumber, priorSendCount: membership.sendCount, errorMessage: reason };
    }

    if (associate.pendingActivationUserId != null) {
      try {
        const activation = await this.accountActivation.createActivationUrl(associate.pendingActivationUserId);
        if (activation) context = { ...context, enlaceActivacion: activation.url };
      } catch {
        // No interrumpe la campaña: se marca ERROR solo este destinatario para
        // evitar que una cuenta PENDING reciba instrucciones de acceso sin enlace.
        await this.deliveryRepository.markDeliveryError(delivery.id, "No se pudo generar el enlace de activación.");
        await this.deliveryRepository.markRecipientError(campaignId, recipientId);
        return { outcome: "ERROR", email: recipient.email, deliveryId: delivery.id, attemptNumber: delivery.attemptNumber, priorSendCount: membership.sendCount, errorMessage: "No se pudo generar el enlace de activación." };
      }
    }
    const subject = renderTemplate(campaign.subject, context);
    const html = renderTemplate(campaign.htmlContent, context);
    const text = campaign.textContent ? renderTemplate(campaign.textContent, context) : undefined;

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
      if (error instanceof MailServiceError && (error.kind === "RATE_LIMITED" || error.kind === "QUOTA_EXCEEDED")) {
        // Límite temporal o cuota del proveedor: no es fallo del destinatario.
        // Se devuelve a PENDING y se señala el tipo para que el motor pause.
        await this.deliveryRepository.markDeliveryError(delivery.id, error.message);
        await this.deliveryRepository.markRecipientPending(campaignId, recipientId);
        return {
          outcome: error.kind === "QUOTA_EXCEEDED" ? "QUOTA_EXCEEDED" : "RATE_LIMITED",
          email: recipient.email,
          deliveryId: delivery.id,
          attemptNumber: delivery.attemptNumber,
          priorSendCount: membership.sendCount,
          errorMessage: error.message,
        };
      }
      const message = error instanceof MailServiceError || error instanceof CampaignMailError ? error.message : "No se pudo enviar el correo.";
      await this.deliveryRepository.markDeliveryError(delivery.id, message);
      await this.deliveryRepository.markRecipientError(campaignId, recipientId);
      return { outcome: "ERROR", email: recipient.email, deliveryId: delivery.id, attemptNumber: delivery.attemptNumber, priorSendCount: membership.sendCount, errorMessage: message };
    }
  }

  /**
   * Resuelve el contexto de personalización para destinatarios del origen
   * "Asociados del sistema", revalidando la cuenta contra la fuente de
   * autenticación en el momento del envío. Devuelve `excluded: true` con motivo
   * si la cuenta dejó de ser elegible o el correo de acceso cambió.
   *
   * Estrategia en dos niveles:
   *  1. Snapshot completo (EmailCampaignRecipient.metadata) → revalida contra la
   *     fuente y usa el nombre capturado al preparar la campaña.
   *  2. Si el snapshot es NULL, usa el enlace corto (EmailRecipient.metadata,
   *     `userId`) → resuelve la identidad completa desde usuario/persona.
   *
   * No emite tokens aquí: el token de activación se genera únicamente después de
   * confirmar que el correo se va a enviar, para evitar tokens huérfanos y
   * reintentos que invaliden enlaces ya entregados.
   */
  private async resolveAssociateContext(
    campaignMetadata: Prisma.JsonValue | null,
    recipientMetadata: Prisma.JsonValue | null | undefined,
  ): Promise<AssociateResolution> {
    const snapshot = toAssociateMetadata(campaignMetadata);
    if (snapshot) return this.resolveFromSnapshot(snapshot);

    const link = toAssociateRecipientLink(recipientMetadata);
    if (link) return this.resolveFromUserId(link.userId);

    return { excluded: false, context: null, pendingActivationUserId: null };
  }

  private async resolveFromSnapshot(snapshot: AssociateRecipientMetadata): Promise<AssociateResolution> {
    const live = await this.associateRepository.getUserAccess(snapshot.userId);
    if (!live || live.deletedAt) return { excluded: true, reason: "La cuenta de acceso del asociado ya no existe." };
    if (live.status !== UserStatus.ACTIVE && live.status !== UserStatus.PENDING) {
      return { excluded: true, reason: "La cuenta de acceso del asociado ya no está habilitada." };
    }
    const liveEmail = live.email.trim().toLowerCase();
    if (liveEmail !== snapshot.correoAcceso.trim().toLowerCase()) {
      return { excluded: true, reason: "El correo de acceso cambió después de preparar la campaña." };
    }

    return {
      excluded: false,
      pendingActivationUserId: live.status === UserStatus.PENDING ? snapshot.userId : null,
      context: {
        nombreCompleto: escapeHtml(snapshot.nombreCompleto),
        correoAcceso: escapeHtml(liveEmail),
        tipoAsociado: tipoAsociadoLabel(snapshot.tipoAsociado),
        enlaceAcceso: `${this.appBaseUrl()}/login`,
        email: liveEmail,
      },
    };
  }

  private async resolveFromUserId(userId: number): Promise<AssociateResolution> {
    const identity = await this.associateRepository.getAssociateIdentity(userId);
    if (!identity || identity.deletedAt) return { excluded: true, reason: "La cuenta de acceso del asociado ya no existe." };
    if (identity.status !== UserStatus.ACTIVE && identity.status !== UserStatus.PENDING) {
      return { excluded: true, reason: "La cuenta de acceso del asociado ya no está habilitada." };
    }
    const liveEmail = identity.email.trim().toLowerCase();
    return {
      excluded: false,
      pendingActivationUserId: identity.status === UserStatus.PENDING ? userId : null,
      context: {
        nombreCompleto: escapeHtml(identity.nombreCompleto ?? ""),
        correoAcceso: escapeHtml(liveEmail),
        tipoAsociado: tipoAsociadoLabel(identity.roleSlug === "ASOCIADO_ESTUDIANTE" ? "ESTUDIANTE" : "ACTIVO"),
        enlaceAcceso: `${this.appBaseUrl()}/login`,
        email: liveEmail,
      },
    };
  }

  private appBaseUrl(): string {
    try {
      return getAppBaseUrl(process.env, { allowDevDefault: true });
    } catch {
      return "";
    }
  }

  /**
   * Fail-fast de configuración: valida que la cuenta SMTP institucional tenga
   * las variables requeridas, sin abrir conexión. Lanza CampaignMailError con
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
