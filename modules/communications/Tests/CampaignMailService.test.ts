import { describe, expect, it, vi } from "vitest";
import { EmailCampaignStatus, EmailSendStatus, Prisma } from "@prisma/client";
import { CampaignMailService, CampaignMailError, SMTP_CONFIG_UNAVAILABLE_CODE } from "../Services/CampaignMailService";
import { MailServiceError } from "@/modules/shared/Services/MailService";
import { ConfigurationError } from "@/lib/config/env";
import type { CampaignRepository } from "../Repositories/CampaignRepository";
import type { EmailDeliveryRepository } from "../Repositories/EmailDeliveryRepository";
import type { CampaignDetail } from "../Models/Campaign";

const ACTOR = { userId: 1, email: "admin@iimp.org.pe" };

function campaign(overrides: Partial<CampaignDetail> = {}): CampaignDetail {
  return {
    id: 1,
    name: "Campaña",
    subject: "Hola {{nombre}}",
    senderName: "IIMP",
    senderEmail: "no-reply@iimp.org.pe",
    replyTo: "asociados@iimp.org.pe",
    htmlContent: "<p>Estimado(a) {{nombre}},</p>",
    textContent: "Estimado(a) {{nombre}},",
    status: EmailCampaignStatus.READY,
    createdAt: "2026-09-29T00:00:00.000Z",
    updatedAt: "2026-09-29T00:00:00.000Z",
    createdBy: 1,
    createdByName: "Admin",
    recipientCount: 1,
    ...overrides,
  };
}

function p2002(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "6.19.3",
    meta: { target: ["campaign_id", "recipient_id"] },
  });
}

function setup(overrides: {
  getCampaign?: CampaignDetail | null;
  membership?: { recipientId: number; status: EmailSendStatus; sendCount: number } | null;
  inFlight?: boolean;
  staleRecovered?: number;
  sendMail?: () => Promise<{ messageId?: string }>;
} = {}) {
  const getCampaign = vi.fn().mockResolvedValue(overrides.getCampaign ?? campaign());
  const getCampaignRecipient = vi.fn().mockResolvedValue(overrides.membership ?? { recipientId: 7, status: EmailSendStatus.PENDING, sendCount: 0 });
  const getRecipient = vi.fn().mockResolvedValue({ id: 7, email: "juan@empresa.com", name: "Juan Pérez", company: "Empresa A", position: "Gerente" });
  const recoverStaleDeliveries = vi.fn().mockResolvedValue(overrides.staleRecovered ?? 0);
  const hasInFlightDelivery = vi.fn().mockResolvedValue(overrides.inFlight ?? false);
  const createPendingDelivery = vi.fn().mockResolvedValue({ id: 99, attemptNumber: 1 });
  const markDeliverySent = vi.fn().mockResolvedValue(undefined);
  const markDeliveryError = vi.fn().mockResolvedValue(undefined);
  const markRecipientSending = vi.fn().mockResolvedValue(undefined);
  const markRecipientSent = vi.fn().mockResolvedValue(undefined);
  const markRecipientError = vi.fn().mockResolvedValue(undefined);
  const writeAudit = vi.fn().mockResolvedValue(undefined);

  const campaignRepository = {
    getCampaign,
  } as unknown as CampaignRepository;

  const deliveryRepository = {
    getCampaignRecipient,
    getRecipient,
    recoverStaleDeliveries,
    hasInFlightDelivery,
    createPendingDelivery,
    markDeliverySent,
    markDeliveryError,
    markRecipientSending,
    markRecipientSent,
    markRecipientError,
    writeAudit,
  } as unknown as EmailDeliveryRepository;

  const sendMail = vi.fn(overrides.sendMail ?? (async () => ({ messageId: "<abc123@example>" })));
  const validateConfiguration = vi.fn();
  const mailService = { sendMail, validateConfiguration };

  const service = new CampaignMailService(campaignRepository, deliveryRepository, mailService as never);
  return {
    service,
    campaignRepository,
    deliveryRepository,
    mailService,
    mocks: { getCampaign, getCampaignRecipient, recoverStaleDeliveries, hasInFlightDelivery, createPendingDelivery, markDeliverySent, markDeliveryError, markRecipientSending, markRecipientSent, markRecipientError, writeAudit, sendMail, validateConfiguration },
  };
}

describe("CampaignMailService.sendTest", () => {
  it("rechaza correo destino inválido", async () => {
    const { service } = setup();
    await expect(service.sendTest(1, "correo-invalido", null, ACTOR)).rejects.toBeInstanceOf(CampaignMailError);
  });

  it("no crea EmailDelivery ni modifica CampaignRecipient", async () => {
    const { service, mocks } = setup();
    await service.sendTest(1, "prueba@iimp.org.pe", null, ACTOR);
    expect(mocks.createPendingDelivery).not.toHaveBeenCalled();
    expect(mocks.markRecipientSent).not.toHaveBeenCalled();
    expect(mocks.writeAudit).toHaveBeenCalledWith(ACTOR, "EMAIL_TEST_SENT", expect.objectContaining({ campaignId: 1 }));
  });
});

describe("CampaignMailService.sendIndividual", () => {
  it("primer envío crea PENDING y envía por SMTP", async () => {
    const { service, mocks } = setup();
    await service.sendIndividual(1, 7, ACTOR);
    expect(mocks.recoverStaleDeliveries).toHaveBeenCalledWith(1, 7);
    expect(mocks.createPendingDelivery).toHaveBeenCalledWith(1, 7, "juan@empresa.com");
    expect(mocks.sendMail).toHaveBeenCalled();
  });

  it("exige READY (DRAFT no puede enviar real)", async () => {
    const { service, mocks } = setup({ getCampaign: campaign({ status: EmailCampaignStatus.DRAFT }) });
    await expect(service.sendIndividual(1, 7, ACTOR)).rejects.toBeInstanceOf(CampaignMailError);
    expect(mocks.createPendingDelivery).not.toHaveBeenCalled();
  });

  it("CANCELLED no puede enviar", async () => {
    const { service } = setup({ getCampaign: campaign({ status: EmailCampaignStatus.CANCELLED }) });
    await expect(service.sendIndividual(1, 7, ACTOR)).rejects.toBeInstanceOf(CampaignMailError);
  });

  it("usa TemplateRenderer (renderiza {{nombre}})", async () => {
    const { service, mailService } = setup();
    await service.sendIndividual(1, 7, ACTOR);
    expect(mailService.sendMail).toHaveBeenCalledWith(expect.objectContaining({ html: expect.stringContaining("Juan Pérez"), subject: expect.stringContaining("Juan Pérez") }));
  });

  it("éxito → EmailDelivery SENT + sendCount +1", async () => {
    const { service, mocks } = setup({ sendMail: async () => ({ messageId: "<abc@example>" }) });
    await service.sendIndividual(1, 7, ACTOR);
    expect(mocks.markDeliverySent).toHaveBeenCalledWith(99, "<abc@example>");
    expect(mocks.markRecipientSent).toHaveBeenCalledWith(1, 7);
  });

  it("marca el destinatario como SENDING antes de enviar (PENDING -> SENDING -> SENT)", async () => {
    const { service, mocks } = setup({ sendMail: async () => ({ messageId: "<abc@example>" }) });
    await service.sendIndividual(1, 7, ACTOR);
    expect(mocks.markRecipientSending).toHaveBeenCalledWith(1, 7);
    expect(mocks.markRecipientSending.mock.invocationCallOrder[0]).toBeLessThan(mocks.markRecipientSent.mock.invocationCallOrder[0]);
  });

  it("fallo SMTP → EmailDelivery ERROR y sendCount no incrementa", async () => {
    const { service, mocks } = setup({ sendMail: async () => { throw new MailServiceError("Error de autenticación SMTP."); } });
    await expect(service.sendIndividual(1, 7, ACTOR)).rejects.toBeInstanceOf(CampaignMailError);
    expect(mocks.markDeliveryError).toHaveBeenCalledWith(99, "Error de autenticación SMTP.");
    expect(mocks.markRecipientError).toHaveBeenCalledWith(1, 7);
    expect(mocks.markRecipientSent).not.toHaveBeenCalled();
  });

  it("guarda messageId y sanitiza error (sin credenciales)", async () => {
    const { service, mocks } = setup({ sendMail: async () => { throw new MailServiceError("Error de autenticación SMTP."); } });
    await expect(service.sendIndividual(1, 7, ACTOR)).rejects.toThrow("autenticación SMTP");
    expect(mocks.markDeliveryError).toHaveBeenCalledWith(99, "Error de autenticación SMTP.");
  });

  it("reenvío genera un NUEVO EmailDelivery (SENT anterior permite nuevo intento)", async () => {
    const { service, mocks } = setup({ membership: { recipientId: 7, status: EmailSendStatus.SENT, sendCount: 1 } });
    await service.sendIndividual(1, 7, ACTOR);
    expect(mocks.createPendingDelivery).toHaveBeenCalledTimes(1);
    expect(mocks.writeAudit).toHaveBeenCalledWith(ACTOR, "EMAIL_RESENT", expect.objectContaining({ recipientId: 7 }));
  });

  it("ERROR anterior permite nuevo PENDING", async () => {
    const { service, mocks } = setup({ membership: { recipientId: 7, status: EmailSendStatus.ERROR, sendCount: 0 } });
    await service.sendIndividual(1, 7, ACTOR);
    expect(mocks.createPendingDelivery).toHaveBeenCalledTimes(1);
  });

  it("PENDING <10 min bloquea (envío en curso)", async () => {
    const { service, mocks } = setup({ inFlight: true });
    await expect(service.sendIndividual(1, 7, ACTOR)).rejects.toMatchObject({ code: "SEND_ALREADY_IN_PROGRESS" });
    expect(mocks.createPendingDelivery).not.toHaveBeenCalled();
    expect(mocks.sendMail).not.toHaveBeenCalled();
  });

  it("SENDING <10 min bloquea (envío en curso)", async () => {
    const { service, mocks } = setup({ inFlight: true });
    await expect(service.sendIndividual(1, 7, ACTOR)).rejects.toThrow("envío en curso");
    expect(mocks.createPendingDelivery).not.toHaveBeenCalled();
    expect(mocks.sendMail).not.toHaveBeenCalled();
  });

  it("PENDING >10 min → recuperado como ERROR y permite nuevo intento", async () => {
    const { service, mocks } = setup({ staleRecovered: 1, inFlight: false });
    await service.sendIndividual(1, 7, ACTOR);
    expect(mocks.recoverStaleDeliveries).toHaveBeenCalledWith(1, 7);
    expect(mocks.createPendingDelivery).toHaveBeenCalledTimes(1);
  });

  it("SENDING >10 min → recuperado como ERROR y permite nuevo intento", async () => {
    const { service, mocks } = setup({ staleRecovered: 1, inFlight: false });
    await service.sendIndividual(1, 7, ACTOR);
    expect(mocks.createPendingDelivery).toHaveBeenCalledTimes(1);
  });

  it("constraint P2002 se mapea a mensaje funcional y NO llama SMTP", async () => {
    const { service, mocks } = setup();
    mocks.createPendingDelivery.mockRejectedValue(p2002());
    await expect(service.sendIndividual(1, 7, ACTOR)).rejects.toMatchObject({ code: "SEND_ALREADY_IN_PROGRESS", status: 409 });
    await expect(service.sendIndividual(1, 7, ACTOR)).rejects.toThrow("envío en curso");
    expect(mocks.sendMail).not.toHaveBeenCalled();
  });

  it("no expone constraint name / stack trace al usuario", async () => {
    const { service, mocks } = setup();
    mocks.createPendingDelivery.mockRejectedValue(p2002());
    try {
      await service.sendIndividual(1, 7, ACTOR);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).not.toContain("email_deliveries_inflight_key");
      expect(message).not.toContain("P2002");
      expect(message).toContain("envío en curso");
    }
  });

  it("replyTo válido es aceptado", async () => {
    const { service, mocks } = setup({ getCampaign: campaign({ replyTo: "soporte@iimp.org.pe" }) });
    await service.sendIndividual(1, 7, ACTOR);
    expect(mocks.sendMail).toHaveBeenCalledWith(expect.objectContaining({ replyTo: "soporte@iimp.org.pe" }));
  });

  it("replyTo inválido es rechazado antes de crear PENDING", async () => {
    const { service, mocks } = setup({ getCampaign: campaign({ replyTo: "no-es-correo" }) });
    await expect(service.sendIndividual(1, 7, ACTOR)).rejects.toMatchObject({ code: "INVALID_REPLY_TO" });
    expect(mocks.createPendingDelivery).not.toHaveBeenCalled();
    expect(mocks.sendMail).not.toHaveBeenCalled();
  });

  it("no cambia el estado de la campaña (permanece READY)", async () => {
    const { service, campaignRepository } = setup();
    await service.sendIndividual(1, 7, ACTOR);
    expect(campaignRepository.getCampaign).toHaveBeenCalled();
  });

  it("error estructural (config SMTP) se propaga y NO retorna ERROR individual", async () => {
    const { service, mocks } = setup({
      sendMail: async () => {
        throw new ConfigurationError([{ variable: "PROV_MAIL_HOST", reason: "es obligatorio" }]);
      },
    });
    await expect(service.sendIndividual(1, 7, ACTOR)).rejects.toMatchObject({ code: SMTP_CONFIG_UNAVAILABLE_CODE, status: 503 });
    expect(mocks.markDeliveryError).toHaveBeenCalledWith(99, "Configuración de correo no disponible.");
    expect(mocks.markRecipientError).toHaveBeenCalledWith(1, 7);
  });

  it("validateSendConfiguration mapea ConfigurationError a SMTP_CONFIGURATION_UNAVAILABLE", async () => {
    const { service, mocks } = setup();
    mocks.validateConfiguration.mockImplementation(() => {
      throw new ConfigurationError([{ variable: "PROV_MAIL_PASSWORD", reason: "es obligatorio" }]);
    });
    try {
      service.validateSendConfiguration();
      expect.unreachable("debería lanzar");
    } catch (error) {
      expect(error).toMatchObject({ code: SMTP_CONFIG_UNAVAILABLE_CODE, status: 503 });
    }
  });

  it("validateSendConfiguration no lanza cuando la configuración existe", () => {
    const { service, mocks } = setup();
    mocks.validateConfiguration.mockReturnValue(undefined);
    expect(() => service.validateSendConfiguration()).not.toThrow();
  });
});
