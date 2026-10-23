import { afterEach, describe, expect, it, vi } from "vitest";
import { EmailCampaignStatus, EmailSendStatus } from "@prisma/client";
import { CampaignMailService, resolveSmtpAccount } from "../Services/CampaignMailService";
import { CampaignRepository } from "../Repositories/CampaignRepository";
import type { CampaignDetail } from "../Models/Campaign";
import type { CampaignRepository as CampaignRepositoryType } from "../Repositories/CampaignRepository";
import type { EmailDeliveryRepository } from "../Repositories/EmailDeliveryRepository";

const ACTOR = { userId: 1, email: "admin@iimp.org.pe" };

function campaign(smtpAccount: "DEFAULT" | "PROV"): CampaignDetail {
  return {
    id: 1,
    name: "Campaña",
    subject: "Asunto",
    senderName: "IIMP",
    senderEmail: null,
    replyTo: null,
    htmlContent: "<p>Hola</p>",
    textContent: null,
    status: EmailCampaignStatus.READY,
    createdAt: "2026-09-29T00:00:00.000Z",
    updatedAt: "2026-09-29T00:00:00.000Z",
    createdBy: 1,
    createdByName: "Admin",
    recipientCount: 1,
    smtpAccount,
    pausedUntil: null,
    pauseReason: null,
  };
}

function setup(smtpAccount: "DEFAULT" | "PROV") {
  const campaignRepository = {
    getCampaign: vi.fn().mockResolvedValue(campaign(smtpAccount)),
  } as unknown as CampaignRepositoryType;

  const deliveryRepository = {
    getCampaignRecipient: vi.fn().mockResolvedValue({ recipientId: 7, status: EmailSendStatus.PENDING, sendCount: 0, metadata: null }),
    getRecipient: vi.fn().mockResolvedValue({ id: 7, email: "juan@empresa.com", name: "Juan", company: null, position: null, metadata: null }),
    recoverStaleDeliveries: vi.fn().mockResolvedValue(0),
    hasInFlightDelivery: vi.fn().mockResolvedValue(false),
    claimRecipient: vi.fn().mockResolvedValue({ claimed: true, status: EmailSendStatus.SENDING, delivery: { id: 99, attemptNumber: 1 } }),
    markDeliverySent: vi.fn().mockResolvedValue(undefined),
    markDeliveryError: vi.fn().mockResolvedValue(undefined),
    markRecipientSent: vi.fn().mockResolvedValue(undefined),
    markRecipientError: vi.fn().mockResolvedValue(undefined),
    markRecipientPending: vi.fn().mockResolvedValue(undefined),
    excludeClaimedDelivery: vi.fn().mockResolvedValue(undefined),
    writeAudit: vi.fn().mockResolvedValue(undefined),
  } as unknown as EmailDeliveryRepository;

  const associateRepository = { getUserAccess: vi.fn(), getAssociateIdentity: vi.fn().mockResolvedValue(null) };
  const accountActivation = { createActivationUrl: vi.fn() };
  const defaultMailService = { sendMail: vi.fn().mockResolvedValue({ messageId: "<default@example>" }), validateConfiguration: vi.fn() };
  const provMailService = { sendMail: vi.fn().mockResolvedValue({ messageId: "<prov@example>" }), validateConfiguration: vi.fn() };

  const service = new CampaignMailService(
    campaignRepository,
    deliveryRepository,
    defaultMailService as never,
    associateRepository as never,
    accountActivation as never,
    provMailService as never,
  );

  return { service, defaultMailService, provMailService, deliveryRepository };
}

describe("resolveSmtpAccount", () => {
  it("campañas históricas sin proveedor explícito resuelven a DEFAULT", () => {
    expect(resolveSmtpAccount(undefined)).toBe("DEFAULT");
    expect(resolveSmtpAccount(null)).toBe("DEFAULT");
    expect(resolveSmtpAccount("DEFAULT")).toBe("DEFAULT");
  });

  it("PROV se conserva explícito (no se cambia de proveedor)", () => {
    expect(resolveSmtpAccount("PROV")).toBe("PROV");
  });
});

describe("CampaignMailService — selección de cuenta SMTP por campaña", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("campaña DEFAULT usa las credenciales DEFAULT", async () => {
    const { service, defaultMailService, provMailService } = setup("DEFAULT");
    await service.sendIndividual(1, 7, ACTOR);
    expect(defaultMailService.sendMail).toHaveBeenCalledTimes(1);
    expect(provMailService.sendMail).not.toHaveBeenCalled();
  });

  it("campaña PROV usa exclusivamente las credenciales PROV", async () => {
    const { service, defaultMailService, provMailService } = setup("PROV");
    await service.sendIndividual(1, 7, ACTOR);
    expect(provMailService.sendMail).toHaveBeenCalledTimes(1);
    expect(defaultMailService.sendMail).not.toHaveBeenCalled();
  });

  it("validateSendConfiguration valida la cuenta PROV indicada", () => {
    const { service, provMailService, defaultMailService } = setup("PROV");
    service.validateSendConfiguration("PROV");
    expect(provMailService.validateConfiguration).toHaveBeenCalledTimes(1);
    expect(defaultMailService.validateConfiguration).not.toHaveBeenCalled();
  });

  it("registra proveedor y remitente en auditoría sin exponer credenciales", async () => {
    vi.stubEnv("PROV_MAIL_HOST", "smtp.prov");
    vi.stubEnv("PROV_MAIL_PORT", "465");
    vi.stubEnv("PROV_MAIL_USERNAME", "prov@example.com");
    vi.stubEnv("PROV_MAIL_PASSWORD", "prov-s3cret");
    vi.stubEnv("PROV_MAIL_FROM", "boletin@iimp.org.pe");

    const { service, deliveryRepository } = setup("PROV");
    await service.sendIndividual(1, 7, ACTOR);

    const call = (deliveryRepository.writeAudit as ReturnType<typeof vi.fn>).mock.calls[0];
    const metadata = call[2] as Record<string, unknown>;
    expect(metadata).toMatchObject({ smtpAccount: "PROV", fromEmail: "boletin@iimp.org.pe" });
    expect(JSON.stringify(metadata)).not.toContain("prov-s3cret");
  });
});

describe("CampaignRepository — persistencia de smtpAccount", () => {
  it("createCampaign persiste DEFAULT cuando se omite la cuenta", async () => {
    const create = vi.fn().mockResolvedValue({ id: 5 });
    const repository = new CampaignRepository({ emailCampaign: { create } } as never);
    await repository.createCampaign({ name: "C", subject: "S", htmlContent: "<p>x</p>" }, 1);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ smtpAccount: "DEFAULT" }) }),
    );
  });

  it("createCampaign persiste PROV cuando se selecciona", async () => {
    const create = vi.fn().mockResolvedValue({ id: 6 });
    const repository = new CampaignRepository({ emailCampaign: { create } } as never);
    await repository.createCampaign({ name: "C", subject: "S", htmlContent: "<p>x</p>", smtpAccount: "PROV" }, 1);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ smtpAccount: "PROV" }) }),
    );
  });

  it("updateCampaign persiste la cuenta elegida", async () => {
    const update = vi.fn().mockResolvedValue({ id: 9 });
    const repository = new CampaignRepository({ emailCampaign: { update } } as never);
    await repository.updateCampaign(9, { name: "C", subject: "S", htmlContent: "<p>x</p>", smtpAccount: "PROV" });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ smtpAccount: "PROV" }) }),
    );
  });

  it("getCampaign devuelve la cuenta persistida", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: 1,
      name: "C",
      subject: "S",
      senderName: null,
      senderEmail: null,
      replyTo: null,
      htmlContent: "<p>x</p>",
      textContent: null,
      status: EmailCampaignStatus.DRAFT,
      smtpAccount: "PROV",
      createdAt: new Date("2026-09-29T00:00:00.000Z"),
      updatedAt: new Date("2026-09-29T00:00:00.000Z"),
      createdBy: 1,
      pausedUntil: null,
      pauseReason: null,
      _count: { recipients: 0 },
      creator: null,
    });
    const repository = new CampaignRepository({ emailCampaign: { findUnique } } as never);
    const detail = await repository.getCampaign(1);
    expect(detail?.smtpAccount).toBe("PROV");
  });
});
