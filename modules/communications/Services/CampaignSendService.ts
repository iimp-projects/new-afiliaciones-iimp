import { EmailCampaignStatus } from "@prisma/client";
import { CampaignMailError, CampaignMailService } from "./CampaignMailService";
import { CampaignRepository } from "../Repositories/CampaignRepository";
import { EmailDeliveryRepository } from "../Repositories/EmailDeliveryRepository";
import {
  CAMPAIGN_BATCH_SIZE,
  CAMPAIGN_CIRCUIT_BREAKER_COOLDOWN_MS,
  CAMPAIGN_CIRCUIT_BREAKER_THRESHOLD,
  CAMPAIGN_STALE_TIMEOUT_MINUTES,
  getCampaignDailyQuotaLimit,
  getCampaignRateLimitCooldownMs,
  nextUtcDayStart,
  startOfUtcDay,
} from "../Config/campaignSend";
import type { CampaignSendProgress, BatchResult } from "../Models/CampaignSend";
import type { CampaignDetail } from "../Models/Campaign";

export interface CampaignSendLimits {
  /** Tope diario de envíos (0 = desactivado, solo reacciona al proveedor). */
  dailyQuotaLimit: number;
  /** Espera tras un límite temporal (rate-limit) del proveedor, en ms. */
  rateLimitCooldownMs: number;
}

/** Actor de una operación de envío (admin real o el worker de sistema). */
export type SendActor = { userId: number | null; email: string };

/** Actor del worker server-side (sin sesión). userId null para no requerir un usuario real. */
export const CAMPAIGN_SEND_SYSTEM_ACTOR: SendActor = { userId: null, email: "system-worker@iimp.org.pe" };

function pauseInfo(campaign: CampaignDetail): { paused: boolean; pauseReason: string | null; resumeAt: string | null } {
  if (!campaign.pausedUntil) return { paused: false, pauseReason: null, resumeAt: null };
  const paused = new Date(campaign.pausedUntil).getTime() > Date.now();
  return { paused, pauseReason: paused ? campaign.pauseReason : null, resumeAt: paused ? campaign.pausedUntil : null };
}

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
 * Control de cuotas/rate-limit: al detectar un límite del proveedor (temporal
 * o de cuota diaria) o al superar la cuota diaria configurada, la campaña se
 * PAUSA (persistiendo `pausedUntil`/`pauseReason`) y se reanuda automáticamente
 * cuando vence la espera. La pausa sobrevive a reinicios y es segura ante
 * múltiples instancias (los estados y contadores viven en la BD).
 */
export class CampaignSendService {
  constructor(
    private readonly campaignRepository = new CampaignRepository(),
    private readonly deliveryRepository = new EmailDeliveryRepository(),
    private readonly mailService = new CampaignMailService(),
    private readonly limits: CampaignSendLimits = {
      dailyQuotaLimit: getCampaignDailyQuotaLimit(),
      rateLimitCooldownMs: getCampaignRateLimitCooldownMs(),
    },
  ) {}

  async start(campaignId: number, actor: { userId: number | null; email: string }): Promise<{ recipientCount: number }> {
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

  async processBatch(campaignId: number, actor: { userId: number | null; email: string }): Promise<BatchResult> {
    const campaign = await this.campaignRepository.getCampaign(campaignId);
    if (!campaign) throw new CampaignMailError("La campaña no existe.", 404);

    if (
      campaign.status === EmailCampaignStatus.COMPLETED ||
      campaign.status === EmailCampaignStatus.PARTIAL ||
      campaign.status === EmailCampaignStatus.CANCELLED
    ) {
      const info = pauseInfo(campaign);
      return { progress: await this.getProgress(campaignId), processedThisBatch: 0, finished: true, ...info };
    }
    if (campaign.status !== EmailCampaignStatus.SENDING) {
      throw new CampaignMailError("La campaña no está en proceso de envío.", 409);
    }

    // Pausa activa: no procesa hasta que venza la espera.
    if (campaign.pausedUntil && new Date(campaign.pausedUntil).getTime() > Date.now()) {
      return { progress: await this.getProgress(campaignId), processedThisBatch: 0, finished: false, paused: true, pauseReason: campaign.pauseReason, resumeAt: campaign.pausedUntil };
    }
    if (campaign.pausedUntil) {
      await this.campaignRepository.clearPause(campaignId);
    }

    // Cuota diaria local configurable (se verifica antes de cada lote).
    if (this.limits.dailyQuotaLimit > 0) {
      const sentToday = await this.deliveryRepository.countSentSince(startOfUtcDay());
      if (sentToday >= this.limits.dailyQuotaLimit) {
        const until = nextUtcDayStart();
        const reason = "Cuota diaria de envío alcanzada.";
        await this.pauseCampaign(campaignId, until, reason, actor, campaign);
        return { progress: await this.getProgress(campaignId), processedThisBatch: 0, finished: false, paused: true, pauseReason: reason, resumeAt: until.toISOString() };
      }
    }

    // Circuit-breaker: si los últimos errores son consecutivos de autenticación
    // SMTP, pausa la campaña para evitar cientos de intentos fallidos. La pausa
    // es persistente (pausedUntil/pauseReason) y evita el envío en bucle.
    const consecutiveAuthErrors = await this.deliveryRepository.countConsecutiveAuthErrors(campaignId, CAMPAIGN_CIRCUIT_BREAKER_THRESHOLD);
    if (consecutiveAuthErrors >= CAMPAIGN_CIRCUIT_BREAKER_THRESHOLD) {
      const reason = "Errores consecutivos de autenticación SMTP: campaña pausada automáticamente.";
      const until = new Date(Date.now() + CAMPAIGN_CIRCUIT_BREAKER_COOLDOWN_MS);
      await this.pauseCampaign(campaignId, until, reason, actor, campaign);
      return { progress: await this.getProgress(campaignId), processedThisBatch: 0, finished: false, paused: true, pauseReason: reason, resumeAt: until.toISOString() };
    }

    // Auto-recuperación: los deliveries realmente atascados (>10 min) pasan a
    // ERROR junto con SOLO sus destinatarios. Los PENDING nunca procesados
    // permanecen PENDING y se continúan en este mismo lote.
    await this.deliveryRepository.recoverStaleDeliveriesForCampaign(campaignId);

    const pending = await this.deliveryRepository.listPendingRecipients(campaignId, CAMPAIGN_BATCH_SIZE);

    let processed = 0;
    let throttled: "RATE_LIMITED" | "QUOTA_EXCEEDED" | null = null;
    if (pending.length > 0) {
      for (const recipient of pending) {
        const result = await this.mailService.deliverRecipient(campaign, campaignId, recipient.recipientId);
        if (result.outcome === "RATE_LIMITED" || result.outcome === "QUOTA_EXCEEDED") {
          throttled = result.outcome;
          break;
        }
        if (result.outcome !== "SKIPPED") processed += 1;
      }
    }

    if (throttled) {
      const isQuota = throttled === "QUOTA_EXCEEDED";
      const until = isQuota ? nextUtcDayStart() : new Date(Date.now() + this.limits.rateLimitCooldownMs);
      const reason = isQuota ? "Cuota diaria de envío del proveedor alcanzada." : "Límite temporal de envío del proveedor alcanzado.";
      await this.pauseCampaign(campaignId, until, reason, actor, campaign);
      return { progress: await this.getProgress(campaignId), processedThisBatch: processed, finished: false, paused: true, pauseReason: reason, resumeAt: until.toISOString() };
    }

    if (pending.length > 0) {
      await this.campaignRepository.touchCampaign(campaignId);
    }

    const finalized = await this.finalizeIfDone(campaign, actor);
    return { progress: await this.getProgress(campaignId), processedThisBatch: processed, finished: finalized, paused: false, pauseReason: null, resumeAt: null };
  }

  async retryFailed(campaignId: number, actor: { userId: number | null; email: string }): Promise<{ retryCount: number }> {
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
   * reanudación. No actúa sobre campañas pausadas.
   */
  async recoverStaleCampaign(campaignId: number, actor: { userId: number | null; email: string }): Promise<{ recovered: boolean }> {
    const campaign = await this.campaignRepository.getCampaign(campaignId);
    if (!campaign) throw new CampaignMailError("La campaña no existe.", 404);
    if (campaign.status !== EmailCampaignStatus.SENDING) return { recovered: false };
    if (campaign.pausedUntil && new Date(campaign.pausedUntil).getTime() > Date.now()) return { recovered: false };

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
      ...pauseInfo(campaign),
    };
  }

  private async pauseCampaign(campaignId: number, until: Date, reason: string, actor: { userId: number | null; email: string }, campaign: CampaignDetail): Promise<void> {
    await this.campaignRepository.pauseCampaign(campaignId, until, reason);
    await this.campaignRepository.writeAudit(actor, "CAMPAIGN_SEND_PAUSED", campaignId, campaign.name, { reason, resumeAt: until.toISOString() });
  }

  /**
   * Finaliza la campaña SOLO cuando no quedan destinatarios PENDING ni SENDING.
   * ERROR = 0 -> COMPLETED; ERROR > 0 -> PARTIAL. Devuelve true si finalizó.
   */
  private async finalizeIfDone(campaign: CampaignDetail, actor: { userId: number | null; email: string }): Promise<boolean> {
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

  /**
   * Tick server-side (independiente de la sesión/navegador): procesa un lote de
   * cada campaña SENDING. Es idempotente y reanudable; el navegador solo consulta
   * el progreso. Un error en una campaña no detiene el tick de las demás.
   */
  async processAllSendingCampaigns(actor: { userId: number | null; email: string }): Promise<{ campaignsProcessed: number; campaignsPaused: number }> {
    const ids = await this.campaignRepository.listSendingCampaignIds();
    let campaignsProcessed = 0;
    let campaignsPaused = 0;
    for (const id of ids) {
      try {
        const result = await this.processBatch(id, actor);
        campaignsProcessed += 1;
        if (result.paused) campaignsPaused += 1;
      } catch (error) {
        console.error("[CAMPAIGN_SEND_TICK] error en campaña", { campaignId: id, error: error instanceof Error ? error.message : "unknown" });
      }
    }
    return { campaignsProcessed, campaignsPaused };
  }
}
