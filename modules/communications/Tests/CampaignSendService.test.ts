import { describe, expect, it, vi } from "vitest";
import { EmailCampaignStatus } from "@prisma/client";
import { CampaignSendService } from "../Services/CampaignSendService";
import { CampaignMailError, SMTP_CONFIG_UNAVAILABLE_CODE } from "../Services/CampaignMailService";
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
    status: EmailCampaignStatus.READY,
    createdAt: "2026-09-29T00:00:00.000Z",
    updatedAt: "2026-09-29T00:00:00.000Z",
    createdBy: 1,
    createdByName: "Admin",
    recipientCount: 100,
    ...overrides,
  };
}

function stats(overrides: Partial<{ recipients: number; sent: number; pending: number; sending: number; error: number }> = {}) {
  return { recipients: 100, sent: 0, pending: 100, sending: 0, error: 0, ...overrides };
}

function setup() {
  const campaignRepository = {
    getCampaign: vi.fn(),
    claimCampaignSending: vi.fn(),
    finalizeCampaign: vi.fn(),
    touchCampaign: vi.fn(),
    setStatus: vi.fn(),
    writeAudit: vi.fn().mockResolvedValue(undefined),
  };
  const deliveryRepository = {
    listPendingRecipients: vi.fn(),
    getCampaignStats: vi.fn(),
    resetErrorRecipientsToPending: vi.fn(),
    recoverStaleDeliveriesForCampaign: vi.fn().mockResolvedValue(0),
  };
  const mailService = {
    deliverRecipient: vi.fn(),
    assertReplyToValid: vi.fn(),
    validateSendConfiguration: vi.fn(),
  };
  const service = new CampaignSendService(campaignRepository as never, deliveryRepository as never, mailService as never);
  return { service, campaignRepository, deliveryRepository, mailService };
}

const pending = (n: number) => Array.from({ length: n }, (_, i) => ({ recipientId: i + 1, email: `r${i + 1}@x.com`, name: `N${i + 1}`, company: null, position: null }));

describe("CampaignSendService.start", () => {
  it("DRAFT no puede iniciar envío", async () => {
    const { service, campaignRepository } = setup();
    campaignRepository.getCampaign.mockResolvedValue(campaign({ status: EmailCampaignStatus.DRAFT }));
    await expect(service.start(1, ACTOR)).rejects.toMatchObject({ status: 409 });
    expect(campaignRepository.claimCampaignSending).not.toHaveBeenCalled();
  });

  it("READY se reclama atómicamente hacia SENDING", async () => {
    const { service, campaignRepository } = setup();
    campaignRepository.getCampaign.mockResolvedValue(campaign());
    campaignRepository.claimCampaignSending.mockResolvedValue(true);
    await service.start(1, ACTOR);
    expect(campaignRepository.claimCampaignSending).toHaveBeenCalledWith(1, EmailCampaignStatus.READY);
    expect(campaignRepository.writeAudit).toHaveBeenCalledWith(ACTOR, "CAMPAIGN_SEND_STARTED", 1, "Campaña", expect.objectContaining({ recipientCount: 100 }));
  });

  it("segundo start simultáneo falla (claim devuelve false)", async () => {
    const { service, campaignRepository } = setup();
    campaignRepository.getCampaign.mockResolvedValue(campaign());
    campaignRepository.claimCampaignSending.mockResolvedValue(false);
    await expect(service.start(1, ACTOR)).rejects.toMatchObject({ code: "CAMPAIGN_ALREADY_STARTED", status: 409 });
    expect(campaignRepository.writeAudit).not.toHaveBeenCalled();
  });

  it("campaña sin destinatarios no puede iniciar", async () => {
    const { service, campaignRepository } = setup();
    campaignRepository.getCampaign.mockResolvedValue(campaign({ recipientCount: 0 }));
    await expect(service.start(1, ACTOR)).rejects.toMatchObject({ status: 422 });
    expect(campaignRepository.claimCampaignSending).not.toHaveBeenCalled();
  });

  it("configuración SMTP faltante hace fail-fast y NO cambia READY->SENDING", async () => {
    const { service, campaignRepository, mailService } = setup();
    campaignRepository.getCampaign.mockResolvedValue(campaign());
    mailService.validateSendConfiguration.mockImplementation(() => {
      throw new CampaignMailError("Configuración de correo no disponible.", 503, SMTP_CONFIG_UNAVAILABLE_CODE);
    });

    await expect(service.start(1, ACTOR)).rejects.toMatchObject({ code: SMTP_CONFIG_UNAVAILABLE_CODE, status: 503 });
    expect(campaignRepository.claimCampaignSending).not.toHaveBeenCalled();
    expect(campaignRepository.writeAudit).not.toHaveBeenCalled();
  });

  it("validación de replyTo se ejecuta antes del claim", async () => {
    const { service, campaignRepository, mailService } = setup();
    campaignRepository.getCampaign.mockResolvedValue(campaign({ replyTo: "no-es-correo" }));
    mailService.assertReplyToValid.mockImplementation(() => {
      throw new CampaignMailError("El correo Reply-To no tiene un formato válido.", 422, "INVALID_REPLY_TO");
    });
    await expect(service.start(1, ACTOR)).rejects.toMatchObject({ code: "INVALID_REPLY_TO" });
    expect(campaignRepository.claimCampaignSending).not.toHaveBeenCalled();
  });
});

describe("CampaignSendService.processBatch", () => {
  it("procesa un lote PENDING secuencialmente (sin Promise.all ilimitado)", async () => {
    const { service, campaignRepository, deliveryRepository, mailService } = setup();
    campaignRepository.getCampaign.mockResolvedValue(campaign({ status: EmailCampaignStatus.SENDING }));
    deliveryRepository.listPendingRecipients.mockResolvedValue(pending(10));
    deliveryRepository.getCampaignStats.mockResolvedValue(stats({ sent: 10, pending: 90 }));
    const order: number[] = [];
    mailService.deliverRecipient.mockImplementation(async (_c: unknown, _id: number, recipientId: number) => {
      order.push(recipientId);
      return { outcome: "SENT", email: `r${recipientId}@x.com` };
    });

    const result = await service.processBatch(1, ACTOR);

    expect(mailService.deliverRecipient).toHaveBeenCalledTimes(10);
    expect(order).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(result.processedThisBatch).toBe(10);
    expect(result.finished).toBe(false);
    expect(campaignRepository.touchCampaign).toHaveBeenCalledWith(1);
    expect(deliveryRepository.recoverStaleDeliveriesForCampaign).toHaveBeenCalledWith(1);
  });

  it("ignora SENT: solo procesa los PENDING devueltos por el repositorio", async () => {
    const { service, campaignRepository, deliveryRepository, mailService } = setup();
    campaignRepository.getCampaign.mockResolvedValue(campaign({ status: EmailCampaignStatus.SENDING }));
    deliveryRepository.listPendingRecipients.mockResolvedValue(pending(2));
    deliveryRepository.getCampaignStats.mockResolvedValue(stats({ sent: 2, pending: 8 }));
    mailService.deliverRecipient.mockResolvedValue({ outcome: "SENT", email: "r@x.com" });

    await service.processBatch(1, ACTOR);

    expect(deliveryRepository.listPendingRecipients).toHaveBeenCalledWith(1, 10);
    expect(mailService.deliverRecipient).toHaveBeenCalledTimes(2);
  });

  it("un ERROR individual no aborta el resto del batch", async () => {
    const { service, campaignRepository, deliveryRepository, mailService } = setup();
    campaignRepository.getCampaign.mockResolvedValue(campaign({ status: EmailCampaignStatus.SENDING }));
    deliveryRepository.listPendingRecipients.mockResolvedValue(pending(3));
    deliveryRepository.getCampaignStats.mockResolvedValue(stats({ sent: 2, error: 1, pending: 7 }));
    mailService.deliverRecipient
      .mockResolvedValueOnce({ outcome: "SENT", email: "a@x.com" })
      .mockResolvedValueOnce({ outcome: "ERROR", email: "b@x.com", errorMessage: "Error de autenticación SMTP." })
      .mockResolvedValueOnce({ outcome: "SENT", email: "c@x.com" });

    const result = await service.processBatch(1, ACTOR);

    expect(mailService.deliverRecipient).toHaveBeenCalledTimes(3);
    expect(result.processedThisBatch).toBe(3);
  });

  it("error estructural (SMTP config) propaga y aborta el batch", async () => {
    const { service, campaignRepository, deliveryRepository, mailService } = setup();
    campaignRepository.getCampaign.mockResolvedValue(campaign({ status: EmailCampaignStatus.SENDING }));
    deliveryRepository.listPendingRecipients.mockResolvedValue(pending(3));
    deliveryRepository.getCampaignStats.mockResolvedValue(stats({ sent: 1, pending: 2 }));
    mailService.deliverRecipient
      .mockResolvedValueOnce({ outcome: "SENT", email: "a@x.com" })
      .mockRejectedValueOnce(new CampaignMailError("Configuración de correo no disponible.", 503, SMTP_CONFIG_UNAVAILABLE_CODE));

    await expect(service.processBatch(1, ACTOR)).rejects.toMatchObject({ code: SMTP_CONFIG_UNAVAILABLE_CODE });
    expect(mailService.deliverRecipient).toHaveBeenCalledTimes(2);
    expect(campaignRepository.finalizeCampaign).not.toHaveBeenCalled();
  });

  it("COMPLETED solo cuando no quedan PENDING/SENDING y no hay ERROR", async () => {
    const { service, campaignRepository, deliveryRepository } = setup();
    campaignRepository.getCampaign.mockResolvedValue(campaign({ status: EmailCampaignStatus.SENDING }));
    deliveryRepository.listPendingRecipients.mockResolvedValue([]);
    deliveryRepository.getCampaignStats.mockResolvedValue(stats({ sent: 100, pending: 0, sending: 0, error: 0 }));
    campaignRepository.finalizeCampaign.mockResolvedValue(true);

    const result = await service.processBatch(1, ACTOR);

    expect(campaignRepository.finalizeCampaign).toHaveBeenCalledWith(1, EmailCampaignStatus.COMPLETED);
    expect(result.finished).toBe(true);
  });

  it("PARTIAL cuando terminó el procesamiento y existen ERROR", async () => {
    const { service, campaignRepository, deliveryRepository } = setup();
    campaignRepository.getCampaign.mockResolvedValue(campaign({ status: EmailCampaignStatus.SENDING }));
    deliveryRepository.listPendingRecipients.mockResolvedValue([]);
    deliveryRepository.getCampaignStats.mockResolvedValue(stats({ sent: 90, error: 10, pending: 0, sending: 0 }));
    campaignRepository.finalizeCampaign.mockResolvedValue(true);

    await service.processBatch(1, ACTOR);
    expect(campaignRepository.finalizeCampaign).toHaveBeenCalledWith(1, EmailCampaignStatus.PARTIAL);
  });

  it("NO finaliza mientras existan PENDING legítimos por procesar", async () => {
    const { service, campaignRepository, deliveryRepository, mailService } = setup();
    campaignRepository.getCampaign.mockResolvedValue(campaign({ status: EmailCampaignStatus.SENDING }));
    deliveryRepository.listPendingRecipients.mockResolvedValue(pending(10));
    deliveryRepository.getCampaignStats.mockResolvedValue(stats({ sent: 40, error: 2, pending: 58, sending: 0 }));
    mailService.deliverRecipient.mockResolvedValue({ outcome: "SENT", email: "r@x.com" });

    const result = await service.processBatch(1, ACTOR);
    expect(campaignRepository.finalizeCampaign).not.toHaveBeenCalled();
    expect(result.finished).toBe(false);
  });

  it("NO finaliza mientras existan SENDING (en vuelo)", async () => {
    const { service, campaignRepository, deliveryRepository } = setup();
    campaignRepository.getCampaign.mockResolvedValue(campaign({ status: EmailCampaignStatus.SENDING }));
    deliveryRepository.listPendingRecipients.mockResolvedValue([]);
    deliveryRepository.getCampaignStats.mockResolvedValue(stats({ sent: 98, error: 0, pending: 0, sending: 2 }));
    campaignRepository.finalizeCampaign.mockResolvedValue(true);

    const result = await service.processBatch(1, ACTOR);
    expect(campaignRepository.finalizeCampaign).not.toHaveBeenCalled();
    expect(result.finished).toBe(false);
  });

  it("processBatch repetido es idempotente (no reenvía SENT)", async () => {
    const { service, campaignRepository, deliveryRepository, mailService } = setup();
    campaignRepository.getCampaign.mockResolvedValue(campaign({ status: EmailCampaignStatus.COMPLETED }));
    deliveryRepository.getCampaignStats.mockResolvedValue(stats({ sent: 100, pending: 0, sending: 0, error: 0 }));

    const result = await service.processBatch(1, ACTOR);
    expect(mailService.deliverRecipient).not.toHaveBeenCalled();
    expect(result.finished).toBe(true);
  });

  it("reanudación de campaña SENDING continúa desde PENDING sin reenviar SENT", async () => {
    const { service, campaignRepository, deliveryRepository, mailService } = setup();
    campaignRepository.getCampaign.mockResolvedValue(campaign({ status: EmailCampaignStatus.SENDING }));
    deliveryRepository.listPendingRecipients.mockResolvedValue(pending(3));
    deliveryRepository.getCampaignStats.mockResolvedValue(stats({ sent: 40, error: 2, pending: 58 }));
    mailService.deliverRecipient.mockResolvedValue({ outcome: "SENT", email: "r@x.com" });

    await service.processBatch(1, ACTOR);

    expect(deliveryRepository.recoverStaleDeliveriesForCampaign).toHaveBeenCalledWith(1);
    expect(mailService.deliverRecipient).toHaveBeenCalledTimes(3);
  });
});

describe("CampaignSendService.getProgress", () => {
  it("calcula total, procesados y porcentaje", async () => {
    const { service, campaignRepository, deliveryRepository } = setup();
    campaignRepository.getCampaign.mockResolvedValue(campaign({ status: EmailCampaignStatus.SENDING }));
    deliveryRepository.getCampaignStats.mockResolvedValue(stats({ sent: 40, pending: 50, sending: 5, error: 5 }));

    const progress = await service.getProgress(1);
    expect(progress).toMatchObject({ total: 100, sent: 40, pending: 50, sending: 5, error: 5, processed: 45, percent: 45, done: false });
  });
});

describe("CampaignSendService.retryFailed", () => {
  it("reintenta solo ERROR y reclama PARTIAL -> SENDING", async () => {
    const { service, campaignRepository, deliveryRepository } = setup();
    campaignRepository.getCampaign.mockResolvedValue(campaign({ status: EmailCampaignStatus.PARTIAL }));
    campaignRepository.claimCampaignSending.mockResolvedValue(true);
    deliveryRepository.resetErrorRecipientsToPending.mockResolvedValue(10);

    const result = await service.retryFailed(1, ACTOR);
    expect(campaignRepository.claimCampaignSending).toHaveBeenCalledWith(1, EmailCampaignStatus.PARTIAL);
    expect(deliveryRepository.resetErrorRecipientsToPending).toHaveBeenCalledWith(1);
    expect(result).toEqual({ retryCount: 10 });
  });

  it("configuración SMTP faltante hace fail-fast antes del claim", async () => {
    const { service, campaignRepository, mailService } = setup();
    campaignRepository.getCampaign.mockResolvedValue(campaign({ status: EmailCampaignStatus.PARTIAL }));
    mailService.validateSendConfiguration.mockImplementation(() => {
      throw new CampaignMailError("Configuración de correo no disponible.", 503, SMTP_CONFIG_UNAVAILABLE_CODE);
    });

    await expect(service.retryFailed(1, ACTOR)).rejects.toMatchObject({ code: SMTP_CONFIG_UNAVAILABLE_CODE });
    expect(campaignRepository.claimCampaignSending).not.toHaveBeenCalled();
  });

  it("no reintenta una campaña que no está en PARTIAL", async () => {
    const { service, campaignRepository } = setup();
    campaignRepository.getCampaign.mockResolvedValue(campaign({ status: EmailCampaignStatus.READY }));
    await expect(service.retryFailed(1, ACTOR)).rejects.toMatchObject({ status: 409 });
    expect(campaignRepository.claimCampaignSending).not.toHaveBeenCalled();
  });

  it("sin errores revierte a PARTIAL y lanza error", async () => {
    const { service, campaignRepository, deliveryRepository } = setup();
    campaignRepository.getCampaign.mockResolvedValue(campaign({ status: EmailCampaignStatus.PARTIAL }));
    campaignRepository.claimCampaignSending.mockResolvedValue(true);
    deliveryRepository.resetErrorRecipientsToPending.mockResolvedValue(0);

    await expect(service.retryFailed(1, ACTOR)).rejects.toMatchObject({ status: 422 });
    expect(campaignRepository.setStatus).toHaveBeenCalledWith(1, EmailCampaignStatus.PARTIAL);
    expect(campaignRepository.writeAudit).not.toHaveBeenCalled();
  });

  it("no toca SENT (solo resetea ERROR -> PENDING)", async () => {
    const { service, campaignRepository, deliveryRepository } = setup();
    campaignRepository.getCampaign.mockResolvedValue(campaign({ status: EmailCampaignStatus.PARTIAL }));
    campaignRepository.claimCampaignSending.mockResolvedValue(true);
    deliveryRepository.resetErrorRecipientsToPending.mockResolvedValue(5);

    await service.retryFailed(1, ACTOR);
    expect(deliveryRepository.resetErrorRecipientsToPending).toHaveBeenCalledTimes(1);
  });
});

describe("CampaignSendService.recoverStaleCampaign", () => {
  it("recupera deliveries atascados pero CONSERVA PENDING nunca procesados (no finaliza)", async () => {
    const { service, campaignRepository, deliveryRepository } = setup();
    campaignRepository.getCampaign.mockResolvedValue(campaign({ status: EmailCampaignStatus.SENDING, updatedAt: "2026-09-29T00:00:00.000Z" }));
    deliveryRepository.getCampaignStats.mockResolvedValue(stats({ sent: 40, error: 2, pending: 58, sending: 0 }));
    campaignRepository.finalizeCampaign.mockResolvedValue(true);

    const result = await service.recoverStaleCampaign(1, ACTOR);

    expect(deliveryRepository.recoverStaleDeliveriesForCampaign).toHaveBeenCalledWith(1);
    expect(campaignRepository.finalizeCampaign).not.toHaveBeenCalled();
    expect(result).toEqual({ recovered: true });
  });

  it("finaliza solo si no quedan PENDING ni SENDING tras recuperar", async () => {
    const { service, campaignRepository, deliveryRepository } = setup();
    campaignRepository.getCampaign.mockResolvedValue(campaign({ status: EmailCampaignStatus.SENDING, updatedAt: "2026-09-29T00:00:00.000Z" }));
    deliveryRepository.getCampaignStats.mockResolvedValue(stats({ sent: 98, error: 2, pending: 0, sending: 0 }));
    campaignRepository.finalizeCampaign.mockResolvedValue(true);

    await service.recoverStaleCampaign(1, ACTOR);
    expect(campaignRepository.finalizeCampaign).toHaveBeenCalledWith(1, EmailCampaignStatus.PARTIAL);
  });

  it("no recupera una campaña reciente", async () => {
    const { service, campaignRepository, deliveryRepository } = setup();
    campaignRepository.getCampaign.mockResolvedValue(campaign({ status: EmailCampaignStatus.SENDING, updatedAt: new Date().toISOString() }));

    const result = await service.recoverStaleCampaign(1, ACTOR);
    expect(result).toEqual({ recovered: false });
    expect(deliveryRepository.recoverStaleDeliveriesForCampaign).not.toHaveBeenCalled();
  });

  it("ignora campañas que no están en SENDING", async () => {
    const { service, campaignRepository, deliveryRepository } = setup();
    campaignRepository.getCampaign.mockResolvedValue(campaign({ status: EmailCampaignStatus.READY }));

    const result = await service.recoverStaleCampaign(1, ACTOR);
    expect(result).toEqual({ recovered: false });
    expect(deliveryRepository.recoverStaleDeliveriesForCampaign).not.toHaveBeenCalled();
  });
});
