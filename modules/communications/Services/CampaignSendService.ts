import { EmailCampaignStatus } from "@prisma/client";
import { CampaignMailError, CampaignMailService } from "./CampaignMailService";
import { CampaignRepository } from "../Repositories/CampaignRepository";
import { EmailDeliveryRepository } from "../Repositories/EmailDeliveryRepository";
import { CAMPAIGN_BATCH_SIZE, CAMPAIGN_STALE_TIMEOUT_MINUTES } from "../Config/campaignSend";
import type { CampaignSendProgress, BatchResult } from "../Models/CampaignSend";
import type { CampaignDetail } from "../Models/Campaign";

/**
 * Motor de envío masivo por lotes.
 *
 * Estrategia: el cliente reclama la campaña (READY/PARTIAL -> SENDING) de forma
 * atómica y luego conduce el progreso mediante invocaciones repetidas de
 * `processBatch` (polling). Cada invocación procesa como máximo
 * `CAMPAIGN_BATCH_SIZE` destinatarios de forma secuencial. El proceso es
 * idempotente y reanudable: al inicio de cada lote recupera entregas obsoletas
 * y continúa únicamente con los PENDING restantes, sin reenviar a SENT.
 *
 * Reanudación tras interrupción (cierre de pestaña, caída del servidor, etc.):
 * al volver a abrir una campaña SENDING el polling vuelve a invocar
 * `processBatch`, que (1) recupera los deliveries realmente atascados (>10 min)
 * marcando SOLO esos destinatarios como ERROR, (2) conserva como PENDING los
 * destinatarios que nunca iniciaron un intento, y (3) continúa procesándolos.
 * Ninguna recuperación reenvía a destinatarios SENT.
 */
export class CampaignSendService {
  constructor(
    private readonly campaignRepository = new CampaignRepository(),
    private readonly deliveryRepository = new EmailDeliveryRepository(),
    private readonly mailService = new CampaignMailService(),
  ) {}

  async start(campaignId: number, actor: { userId: number; email: string }): Promise<{ recipientCount: number }> {
    const campaign = await this.campaignRepository.getCampaign(campaignId);
    if (!campaign) throw new CampaignMailError("La campaña no existe.", 404);
    if (campaign.status === EmailCampaignStatus.SENDING) {
      throw new CampaignMailError("La campaña ya está en proceso de envío.", 409, "CAMPAIGN_ALREADY_STARTED");
    }
    if (campaign.status !== EmailCampaignStatus.READY) {
      throw new CampaignMailError("Solo se puede iniciar el envío de una campaña lista.", 409);
    }
    if (campaign.recipientCount < 1) {
      throw new CampaignMailError("La campaña no tiene destinatarios.", 422);
    }
    this.mailService.assertReplyToValid(campaign.replyTo);
    this.mailService.validateSendConfiguration();

    const claimed = await this.campaignRepository.claimCampaignSending(campaignId, EmailCampaignStatus.READY);
    if (!claimed) {
      throw new CampaignMailError("La campaña ya fue iniciada por otro proceso.", 409, "CAMPAIGN_ALREADY_STARTED");
    }
    await this.campaignRepository.writeAudit(actor, "CAMPAIGN_SEND_STARTED", campaignId, campaign.name, { recipientCount: campaign.recipientCount });
    return { recipientCount: campaign.recipientCount };
  }

  async processBatch(campaignId: number, actor: { userId: number; email: string }): Promise<BatchResult> {
    const campaign = await this.campaignRepository.getCampaign(campaignId);
    if (!campaign) throw new CampaignMailError("La campaña no existe.", 404);

    if (
      campaign.status === EmailCampaignStatus.COMPLETED ||
      campaign.status === EmailCampaignStatus.PARTIAL ||
      campaign.status === EmailCampaignStatus.CANCELLED
    ) {
      return { progress: await this.getProgress(campaignId), processedThisBatch: 0, finished: true };
    }
    if (campaign.status !== EmailCampaignStatus.SENDING) {
      throw new CampaignMailError("La campaña no está en proceso de envío.", 409);
    }

    // Auto-recuperación: los deliveries realmente atascados (>10 min) pasan a
    // ERROR junto con SOLO sus destinatarios. Los PENDING nunca procesados
    // permanecen PENDING y se continúan en este mismo lote.
    await this.deliveryRepository.recoverStaleDeliveriesForCampaign(campaignId);

    const pending = await this.deliveryRepository.listPendingRecipients(campaignId, CAMPAIGN_BATCH_SIZE);

    let processed = 0;
    if (pending.length > 0) {
      for (const recipient of pending) {
        const result = await this.mailService.deliverRecipient(campaign, campaignId, recipient.recipientId);
        if (result.outcome !== "SKIPPED") processed += 1;
      }
      await this.campaignRepository.touchCampaign(campaignId);
    }

    const finalized = await this.finalizeIfDone(campaign, actor);
    return { progress: await this.getProgress(campaignId), processedThisBatch: processed, finished: finalized };
  }

  async retryFailed(campaignId: number, actor: { userId: number; email: string }): Promise<{ retryCount: number }> {
    const campaign = await this.campaignRepository.getCampaign(campaignId);
    if (!campaign) throw new CampaignMailError("La campaña no existe.", 404);
    if (campaign.status !== EmailCampaignStatus.PARTIAL) {
      throw new CampaignMailError("Solo se pueden reintentar destinatarios de una campaña con errores.", 409);
    }
    this.mailService.assertReplyToValid(campaign.replyTo);
    this.mailService.validateSendConfiguration();

    const claimed = await this.campaignRepository.claimCampaignSending(campaignId, EmailCampaignStatus.PARTIAL);
    if (!claimed) {
      throw new CampaignMailError("La campaña ya fue iniciada por otro proceso.", 409, "CAMPAIGN_ALREADY_STARTED");
    }

    const retryCount = await this.deliveryRepository.resetErrorRecipientsToPending(campaignId);
    if (retryCount === 0) {
      await this.campaignRepository.setStatus(campaignId, EmailCampaignStatus.PARTIAL);
      throw new CampaignMailError("No hay destinatarios con errores para reintentar.", 422);
    }

    await this.campaignRepository.writeAudit(actor, "CAMPAIGN_RETRY_STARTED", campaignId, campaign.name, { retryCount });
    return { retryCount };
  }

  /**
   * Recupera una campaña SENDING interrumpida (sin heartbeat en
   * `CAMPAIGN_STALE_TIMEOUT_MINUTES`). Recupera únicamente los deliveries
   * realmente atascados y marca SOLO esos destinatarios como ERROR. Los
   * destinatarios PENDING nunca procesados permanecen PENDING para permitir la
   * reanudación. Solo finaliza si no quedan PENDING ni SENDING.
   */
  async recoverStaleCampaign(campaignId: number, actor: { userId: number; email: string }): Promise<{ recovered: boolean }> {
    const campaign = await this.campaignRepository.getCampaign(campaignId);
    if (!campaign) throw new CampaignMailError("La campaña no existe.", 404);
    if (campaign.status !== EmailCampaignStatus.SENDING) return { recovered: false };

    const cutoff = new Date(Date.now() - CAMPAIGN_STALE_TIMEOUT_MINUTES * 60_000);
    if (new Date(campaign.updatedAt).getTime() > cutoff.getTime()) return { recovered: false };

    await this.deliveryRepository.recoverStaleDeliveriesForCampaign(campaignId);
    const finalized = await this.finalizeIfDone(campaign, actor);
    if (finalized) {
      await this.campaignRepository.writeAudit(actor, "CAMPAIGN_SEND_RECOVERED", campaignId, campaign.name, {});
    }
    return { recovered: true };
  }

  async getProgress(campaignId: number): Promise<CampaignSendProgress> {
    const campaign = await this.campaignRepository.getCampaign(campaignId);
    if (!campaign) throw new CampaignMailError("La campaña no existe.", 404);
    const stats = await this.deliveryRepository.getCampaignStats(campaignId);
    const processed = stats.sent + stats.error;
    const percent = stats.recipients === 0 ? 0 : Math.round((processed / stats.recipients) * 100);
    const done =
      campaign.status === EmailCampaignStatus.COMPLETED ||
      campaign.status === EmailCampaignStatus.PARTIAL ||
      campaign.status === EmailCampaignStatus.CANCELLED;
    return {
      campaignId,
      status: campaign.status,
      total: stats.recipients,
      sent: stats.sent,
      sending: stats.sending,
      pending: stats.pending,
      error: stats.error,
      processed,
      percent,
      done,
    };
  }

  /**
   * Finaliza la campaña SOLO cuando no quedan destinatarios PENDING ni SENDING.
   * ERROR = 0 -> COMPLETED; ERROR > 0 -> PARTIAL. Devuelve true si finalizó.
   */
  private async finalizeIfDone(campaign: CampaignDetail, actor: { userId: number; email: string }): Promise<boolean> {
    const stats = await this.deliveryRepository.getCampaignStats(campaign.id);
    if (stats.pending > 0 || stats.sending > 0) return false;

    const status = stats.error === 0 ? EmailCampaignStatus.COMPLETED : EmailCampaignStatus.PARTIAL;
    const finalized = await this.campaignRepository.finalizeCampaign(campaign.id, status);
    if (finalized) {
      await this.campaignRepository.writeAudit(
        actor,
        status === EmailCampaignStatus.COMPLETED ? "CAMPAIGN_SEND_COMPLETED" : "CAMPAIGN_SEND_PARTIAL",
        campaign.id,
        campaign.name,
        { sent: stats.sent, error: stats.error, pending: stats.pending, sending: stats.sending },
      );
    }
    return finalized;
  }
}
