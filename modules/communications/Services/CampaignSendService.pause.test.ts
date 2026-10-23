import { describe, expect, it, vi } from "vitest";
import { EmailCampaignStatus } from "@prisma/client";
import { CampaignSendService, type CampaignSendLimits } from "../Services/CampaignSendService";
import type { CampaignDetail } from "../Models/Campaign";

const ACTOR = { userId: 1, email: "admin@iimp.org.pe" };

function campaign(overrides: Partial<CampaignDetail> = {}): CampaignDetail {
  return {
    id: 1,
    name: "Campaña",
    subject: "Asunto",
    senderName: "IIMP",
    senderEmail: "no-reply@iimp.org.pe",
    replyTo: null,
    htmlContent: "<p>x</p>",
    textContent: "x",
    status: EmailCampaignStatus.SENDING,
    createdAt: "2026-09-29T00:00:00.000Z",
    updatedAt: "2026-09-29T00:00:00.000Z",
    createdBy: 1,
    createdByName: "Admin",
    recipientCount: 100,
    smtpAccount: "DEFAULT",
    pausedUntil: null,
    pauseReason: null,
    ...overrides,
  };
}

function stats(overrides: Partial<{ recipients: number; sent: number; pending: number; sending: number; error: number }> = {}) {
  return { recipients: 100, sent: 0, pending: 100, sending: 0, error: 0, ...overrides };
}

function setup(limits: Partial<CampaignSendLimits> = {}) {
  const campaignRepository = {
    getCampaign: vi.fn(),
    claimCampaignSending: vi.fn(),
    finalizeCampaign: vi.fn(),
    touchCampaign: vi.fn(),
    setStatus: vi.fn(),
    writeAudit: vi.fn().mockResolvedValue(undefined),
    pauseCampaign: vi.fn().mockResolvedValue(undefined),
    clearPause: vi.fn().mockResolvedValue(undefined),
  };
  const deliveryRepository = {
    listPendingRecipients: vi.fn(),
    getCampaignStats: vi.fn(),
    resetErrorRecipientsToPending: vi.fn(),
    recoverStaleDeliveriesForCampaign: vi.fn().mockResolvedValue(0),
    countSentSince: vi.fn().mockResolvedValue(0),
    countConsecutiveAuthErrors: vi.fn().mockResolvedValue(0),
  };
  const mailService = {
    deliverRecipient: vi.fn(),
    assertReplyToValid: vi.fn(),
    validateSendConfiguration: vi.fn(),
  };
  const service = new CampaignSendService(
    campaignRepository as never,
    deliveryRepository as never,
    mailService as never,
    { dailyQuotaLimit: 0, rateLimitCooldownMs: 60_000, ...limits } as CampaignSendLimits,
  );
  return { service, campaignRepository, deliveryRepository, mailService };
}

const pending = (n: number) => Array.from({ length: n }, (_, i) => ({ recipientId: i + 1, email: `r${i + 1}@x.com`, name: null, company: null, position: null }));

describe("CampaignSendService — control de cuotas y pausa", () => {
  it("pausa activa impide procesar y expone estado", async () => {
    const { service, campaignRepository, deliveryRepository, mailService } = setup();
    campaignRepository.getCampaign.mockResolvedValue(campaign({ pausedUntil: new Date(Date.now() + 60_000).toISOString(), pauseReason: "Límite temporal de envío del proveedor alcanzado." }));
    deliveryRepository.getCampaignStats.mockResolvedValue(stats());

    const result = await service.processBatch(1, ACTOR);

    expect(result.paused).toBe(true);
    expect(result.pauseReason).toContain("Límite temporal");
    expect(result.resumeAt).not.toBeNull();
    expect(mailService.deliverRecipient).not.toHaveBeenCalled();
    expect(deliveryRepository.recoverStaleDeliveriesForCampaign).not.toHaveBeenCalled();
  });

  it("pausa vencida se limpia y reanuda", async () => {
    const { service, campaignRepository, deliveryRepository } = setup();
    campaignRepository.getCampaign.mockResolvedValue(campaign({ pausedUntil: new Date(Date.now() - 60_000).toISOString() }));
    deliveryRepository.listPendingRecipients.mockResolvedValue([]);
    deliveryRepository.getCampaignStats.mockResolvedValue(stats({ sent: 100, pending: 0 }));
    campaignRepository.finalizeCampaign.mockResolvedValue(true);

    await service.processBatch(1, ACTOR);

    expect(campaignRepository.clearPause).toHaveBeenCalledWith(1);
    expect(campaignRepository.finalizeCampaign).toHaveBeenCalledWith(1, EmailCampaignStatus.COMPLETED);
  });

  it("cuota diaria local alcanzada pausa hasta el día siguiente", async () => {
    const { service, campaignRepository, deliveryRepository, mailService } = setup({ dailyQuotaLimit: 100 });
    campaignRepository.getCampaign.mockResolvedValue(campaign());
    deliveryRepository.countSentSince.mockResolvedValue(100);
    deliveryRepository.getCampaignStats.mockResolvedValue(stats());

    const result = await service.processBatch(1, ACTOR);

    expect(deliveryRepository.countSentSince).toHaveBeenCalled();
    expect(campaignRepository.pauseCampaign).toHaveBeenCalledWith(1, expect.any(Date), "Cuota diaria de envío alcanzada.");
    expect(result.paused).toBe(true);
    expect(mailService.deliverRecipient).not.toHaveBeenCalled();
  });

  it("rate-limit temporal detiene el lote y pausa con cooldown", async () => {
    const { service, campaignRepository, deliveryRepository, mailService } = setup({ rateLimitCooldownMs: 60_000 });
    campaignRepository.getCampaign.mockResolvedValue(campaign());
    deliveryRepository.listPendingRecipients.mockResolvedValue(pending(5));
    deliveryRepository.getCampaignStats.mockResolvedValue(stats({ sent: 10, pending: 90 }));
    mailService.deliverRecipient.mockResolvedValue({ outcome: "RATE_LIMITED", email: "r@x.com" });

    const result = await service.processBatch(1, ACTOR);

    expect(mailService.deliverRecipient).toHaveBeenCalledTimes(1);
    expect(campaignRepository.pauseCampaign).toHaveBeenCalledWith(1, expect.any(Date), "Límite temporal de envío del proveedor alcanzado.");
    expect(result.paused).toBe(true);
    expect(campaignRepository.finalizeCampaign).not.toHaveBeenCalled();
  });

  it("cuota de proveedor pausa hasta el día siguiente", async () => {
    const { service, campaignRepository, deliveryRepository, mailService } = setup();
    campaignRepository.getCampaign.mockResolvedValue(campaign());
    deliveryRepository.listPendingRecipients.mockResolvedValue(pending(2));
    deliveryRepository.getCampaignStats.mockResolvedValue(stats());
    mailService.deliverRecipient.mockResolvedValue({ outcome: "QUOTA_EXCEEDED", email: "r@x.com" });

    await service.processBatch(1, ACTOR);

    expect(campaignRepository.pauseCampaign).toHaveBeenCalledWith(1, expect.any(Date), "Cuota diaria de envío del proveedor alcanzada.");
  });

  it("un ERROR permanente individual no pausa la campaña", async () => {
    const { service, campaignRepository, deliveryRepository, mailService } = setup();
    campaignRepository.getCampaign.mockResolvedValue(campaign());
    deliveryRepository.listPendingRecipients.mockResolvedValue(pending(3));
    deliveryRepository.getCampaignStats.mockResolvedValue(stats({ sent: 2, error: 1, pending: 7 }));
    mailService.deliverRecipient
      .mockResolvedValueOnce({ outcome: "SENT", email: "a@x.com" })
      .mockResolvedValueOnce({ outcome: "ERROR", email: "b@x.com", errorMessage: "rejected" })
      .mockResolvedValueOnce({ outcome: "SENT", email: "c@x.com" });

    const result = await service.processBatch(1, ACTOR);

    expect(result.paused).toBe(false);
    expect(campaignRepository.pauseCampaign).not.toHaveBeenCalled();
    expect(mailService.deliverRecipient).toHaveBeenCalledTimes(3);
  });

  it("reanudación tras pausa no reenvía destinatarios SENT", async () => {
    const { service, campaignRepository, deliveryRepository, mailService } = setup();
    campaignRepository.getCampaign.mockResolvedValue(campaign());
    deliveryRepository.listPendingRecipients.mockResolvedValue(pending(2));
    deliveryRepository.getCampaignStats.mockResolvedValue(stats({ sent: 40, pending: 60 }));
    mailService.deliverRecipient.mockResolvedValue({ outcome: "SENT", email: "r@x.com" });

    await service.processBatch(1, ACTOR);

    // Solo procesa los PENDING devueltos por el repositorio (2), sin reenviar los 40 SENT.
    expect(mailService.deliverRecipient).toHaveBeenCalledTimes(2);
  });
});
