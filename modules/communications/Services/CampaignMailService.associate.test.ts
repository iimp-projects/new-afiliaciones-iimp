import { describe, expect, it, vi } from "vitest";
import { EmailCampaignStatus, EmailSendStatus, UserStatus } from "@prisma/client";
import { CampaignMailService } from "./CampaignMailService";
import { MailServiceError } from "@/modules/shared/Services/MailService";
import type { CampaignDetail } from "../Models/Campaign";
import type { AssociateRecipientMetadata } from "../Models/AssociateRecipient";

function campaign(): CampaignDetail {
  return {
    id: 1,
    name: "Campaña",
    subject: "Hola {{nombre_completo}}",
    senderName: "IIMP",
    senderEmail: "no-reply@iimp.org.pe",
    replyTo: null,
    htmlContent: "<p>{{nombre_completo}} / {{correo_acceso}} / {{tipo_asociado}} / {{enlace_acceso}} / {{enlace_activacion}}</p>",
    textContent: "texto",
    status: EmailCampaignStatus.READY,
    createdAt: "2026-09-29T00:00:00.000Z",
    updatedAt: "2026-09-29T00:00:00.000Z",
    createdBy: 1,
    createdByName: "Admin",
    recipientCount: 1,
    pausedUntil: null,
    pauseReason: null,
  };
}

function metadata(overrides: Partial<AssociateRecipientMetadata> = {}): AssociateRecipientMetadata {
  return {
    source: "associates",
    userId: 7,
    personId: 10,
    nombreCompleto: "Juan Pérez",
    correoAcceso: "juan@iimp.org.pe",
    tipoAsociado: "ACTIVO",
    accountStatus: "ACTIVE",
    documentNumber: "12345678",
    ...overrides,
  };
}

function setup(overrides: { metadata?: unknown; live?: unknown } = {}) {
  const deliveryRepository = {
    getCampaignRecipient: vi.fn().mockResolvedValue({ recipientId: 5, status: EmailSendStatus.PENDING, sendCount: 0, metadata: overrides.metadata === undefined ? metadata() : overrides.metadata }),
    getRecipient: vi.fn().mockResolvedValue({ id: 5, email: "juan@iimp.org.pe", name: "Juan Pérez", company: null, position: null }),
    recoverStaleDeliveries: vi.fn().mockResolvedValue(0),
    hasInFlightDelivery: vi.fn().mockResolvedValue(false),
    createPendingDelivery: vi.fn().mockResolvedValue({ id: 99, attemptNumber: 1 }),
    markRecipientSending: vi.fn().mockResolvedValue(undefined),
    markDeliverySent: vi.fn().mockResolvedValue(undefined),
    markRecipientSent: vi.fn().mockResolvedValue(undefined),
    markDeliveryError: vi.fn().mockResolvedValue(undefined),
    markRecipientError: vi.fn().mockResolvedValue(undefined),
    markRecipientPending: vi.fn().mockResolvedValue(undefined),
    recordRecipientExclusion: vi.fn().mockResolvedValue(undefined),
    writeAudit: vi.fn().mockResolvedValue(undefined),
  };
  const associateRepository = {
    getUserAccess: vi.fn().mockResolvedValue(overrides.live === undefined ? { id: 7, email: "juan@iimp.org.pe", status: UserStatus.ACTIVE, deletedAt: null, roleSlug: "ASOCIADO_ACTIVO" } : overrides.live),
  };
  const accountActivation = { createActivationUrl: vi.fn().mockResolvedValue({ email: "juan@iimp.org.pe", url: "https://portal/activar-cuenta?token=t" }) };
  const mailService = { sendMail: vi.fn().mockResolvedValue({ messageId: "<abc@example>" }), validateConfiguration: vi.fn() };

  const service = new CampaignMailService(
    {} as never,
    deliveryRepository as never,
    mailService as never,
    associateRepository as never,
    accountActivation as never,
  );

  return { service, deliveryRepository, associateRepository, accountActivation, mailService };
}

describe("CampaignMailService — origen 'Asociados del sistema'", () => {
  it("revalida la cuenta y personaliza con variables de asociado", async () => {
    const { service, mailService, deliveryRepository } = setup();
    const result = await service.deliverRecipient(campaign(), 1, 5);
    expect(result.outcome).toBe("SENT");
    expect(mailService.sendMail).toHaveBeenCalledWith(expect.objectContaining({
      html: expect.stringContaining("Juan Pérez"),
      subject: expect.stringContaining("Juan Pérez"),
    }));
    expect(deliveryRepository.recordRecipientExclusion).not.toHaveBeenCalled();
  });

  it("excluye si el correo de acceso cambió tras preparar la campaña", async () => {
    const { service, deliveryRepository, mailService } = setup({
      live: { id: 7, email: "otro@iimp.org.pe", status: UserStatus.ACTIVE, deletedAt: null, roleSlug: "ASOCIADO_ACTIVO" },
    });
    const result = await service.deliverRecipient(campaign(), 1, 5);
    expect(result.outcome).toBe("ERROR");
    expect(deliveryRepository.recordRecipientExclusion).toHaveBeenCalledWith(1, 5, "juan@iimp.org.pe", expect.stringContaining("cambió"));
    expect(mailService.sendMail).not.toHaveBeenCalled();
  });

  it("excluye si la cuenta ya no existe", async () => {
    const { service, mailService } = setup({ live: null });
    const result = await service.deliverRecipient(campaign(), 1, 5);
    expect(result.outcome).toBe("ERROR");
    expect(mailService.sendMail).not.toHaveBeenCalled();
  });

  it("genera enlace de activación solo para cuentas PENDING", async () => {
    const { service, accountActivation, mailService } = setup({
      metadata: metadata({ accountStatus: "PENDING" }),
      live: { id: 7, email: "juan@iimp.org.pe", status: UserStatus.PENDING, deletedAt: null, roleSlug: "ASOCIADO_ACTIVO" },
    });
    const result = await service.deliverRecipient(campaign(), 1, 5);
    expect(result.outcome).toBe("SENT");
    expect(accountActivation.createActivationUrl).toHaveBeenCalledWith(7);
    expect(mailService.sendMail).toHaveBeenCalledWith(expect.objectContaining({ html: expect.stringContaining("activar-cuenta") }));
  });

  it("no genera enlace de activación para cuentas ACTIVE", async () => {
    const { service, accountActivation } = setup();
    await service.deliverRecipient(campaign(), 1, 5);
    expect(accountActivation.createActivationUrl).not.toHaveBeenCalled();
  });

  it("destinatario sin metadata mantiene el comportamiento original", async () => {
    const { service, mailService } = setup({ metadata: null });
    const legacyCampaign = { ...campaign(), subject: "Hola {{nombre}}", htmlContent: "<p>{{nombre}}</p>" };
    const result = await service.deliverRecipient(legacyCampaign, 1, 5);
    expect(result.outcome).toBe("SENT");
    expect(mailService.sendMail).toHaveBeenCalledWith(expect.objectContaining({ subject: expect.stringContaining("Juan Pérez") }));
  });

  it("fallo al generar el enlace de activación marca ERROR sin interrumpir la campaña", async () => {
    const { service, accountActivation, deliveryRepository, mailService } = setup({
      metadata: metadata({ accountStatus: "PENDING" }),
      live: { id: 7, email: "juan@iimp.org.pe", status: UserStatus.PENDING, deletedAt: null, roleSlug: "ASOCIADO_ACTIVO" },
    });
    (accountActivation.createActivationUrl as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("APP_URL_NOT_CONFIGURED"));

    const result = await service.deliverRecipient(campaign(), 1, 5);
    expect(result.outcome).toBe("ERROR");
    expect(result.errorMessage).toContain("enlace de activación");
    expect(deliveryRepository.markRecipientError).toHaveBeenCalledWith(1, 5);
    expect(mailService.sendMail).not.toHaveBeenCalled();
  });

  it("rate-limit del proveedor devuelve el destinatario a PENDING (RATE_LIMITED)", async () => {
    const { service, deliveryRepository, mailService } = setup({ metadata: null });
    mailService.sendMail.mockRejectedValueOnce(new MailServiceError("Límite temporal de envío del proveedor alcanzado.", "RATE_LIMITED"));

    const result = await service.deliverRecipient(campaign(), 1, 5);
    expect(result.outcome).toBe("RATE_LIMITED");
    expect(deliveryRepository.markRecipientPending).toHaveBeenCalledWith(1, 5);
    expect(deliveryRepository.markRecipientError).not.toHaveBeenCalled();
  });

  it("cuota diaria del proveedor devuelve QUOTA_EXCEEDED", async () => {
    const { service, deliveryRepository, mailService } = setup({ metadata: null });
    mailService.sendMail.mockRejectedValueOnce(new MailServiceError("Cuota diaria de envío del proveedor alcanzada.", "QUOTA_EXCEEDED"));

    const result = await service.deliverRecipient(campaign(), 1, 5);
    expect(result.outcome).toBe("QUOTA_EXCEEDED");
    expect(deliveryRepository.markRecipientPending).toHaveBeenCalledWith(1, 5);
  });
});
