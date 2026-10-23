import { describe, expect, it, vi } from "vitest";
import { EmailCampaignStatus } from "@prisma/client";
import { CampaignSendService, CAMPAIGN_SEND_SYSTEM_ACTOR } from "./CampaignSendService";
import { CAMPAIGN_CIRCUIT_BREAKER_THRESHOLD } from "../Config/campaignSend";
import type { CampaignDetail } from "../Models/Campaign";

const ACTOR = { userId: 1, email: "admin@iimp.org.pe" };

function campaign(overrides: Partial<CampaignDetail> = {}): CampaignDetail {
  return {
    id: 1,
    name: "Campaña",
    subject: "Asunto",
    senderName: "IIMP",
    senderEmail: "no-reply@iimp.org.pe",
    replyTo: "asociados@iimp.org.pe",
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

function setup() {
  const campaignRepository = {
    getCampaign: vi.fn(),
    claimCampaignSending: vi.fn(),
    finalizeCampaign: vi.fn().mockResolvedValue(false),
    touchCampaign: vi.fn(),
    setStatus: vi.fn(),
    writeAudit: vi.fn().mockResolvedValue(undefined),
    pauseCampaign: vi.fn().mockResolvedValue(undefined),
    clearPause: vi.fn().mockResolvedValue(undefined),
    listSendingCampaignIds: vi.fn().mockResolvedValue([]),
  };
  const deliveryRepository = {
    listPendingRecipients: vi.fn().mockResolvedValue([]),
    getCampaignStats: vi.fn().mockResolvedValue({ recipients: 100, sent: 0, pending: 100, sending: 0, error: 0 }),
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
  const service = new CampaignSendService(campaignRepository as never, deliveryRepository as never, mailService as never, { dailyQuotaLimit: 0, rateLimitCooldownMs: 900000 });
  return { service, campaignRepository, deliveryRepository, mailService };
}

describe("CampaignSendService — worker server-side", () => {
  it("pausa la campaña tras errores AUTH consecutivos (circuit-breaker)", async () => {
    const { service, campaignRepository, deliveryRepository } = setup();
    campaignRepository.getCampaign.mockResolvedValue(campaign());
    deliveryRepository.countConsecutiveAuthErrors.mockResolvedValue(CAMPAIGN_CIRCUIT_BREAKER_THRESHOLD);

    const result = await service.processBatch(1, ACTOR);

    expect(result.paused).toBe(true);
    expect(result.pauseReason).toContain("autenticación SMTP");
    expect(campaignRepository.pauseCampaign).toHaveBeenCalledWith(1, expect.any(Date), expect.stringContaining("autenticación SMTP"));
    expect(deliveryRepository.listPendingRecipients).not.toHaveBeenCalled();
  });

  it("no pausa cuando no hay errores AUTH consecutivos", async () => {
    const { service, campaignRepository, deliveryRepository } = setup();
    campaignRepository.getCampaign.mockResolvedValue(campaign());
    deliveryRepository.countConsecutiveAuthErrors.mockResolvedValue(0);
    deliveryRepository.listPendingRecipients.mockResolvedValue([]);

    const result = await service.processBatch(1, ACTOR);

    expect(result.paused).toBe(false);
    expect(campaignRepository.pauseCampaign).not.toHaveBeenCalled();
  });

  it("processAllSendingCampaigns procesa cada campaña SENDING y aísla errores", async () => {
    const { service, campaignRepository, deliveryRepository } = setup();
    campaignRepository.listSendingCampaignIds.mockResolvedValue([1, 2, 3]);
    campaignRepository.getCampaign.mockImplementation((id: number) => {
      if (id === 2) return Promise.reject(new Error("boom"));
      return Promise.resolve(campaign({ id }));
    });
    deliveryRepository.listPendingRecipients.mockResolvedValue([]);

    const result = await service.processAllSendingCampaigns(CAMPAIGN_SEND_SYSTEM_ACTOR);

    // La campaña 2 falló y fue aislada; 1 y 3 se procesaron.
    expect(result.campaignsProcessed).toBe(2);
    expect(result.campaignsPaused).toBe(0);
  });

  it("processAllSendingCampaigns sin campañas SENDING no procesa nada", async () => {
    const { service, campaignRepository } = setup();
    campaignRepository.listSendingCampaignIds.mockResolvedValue([]);

    const result = await service.processAllSendingCampaigns(CAMPAIGN_SEND_SYSTEM_ACTOR);

    expect(result.campaignsProcessed).toBe(0);
    expect(campaignRepository.getCampaign).not.toHaveBeenCalled();
  });
});
