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
    smtpAccount: "DEFAULT",
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

function setup(overrides: {
  metadata?: unknown;
  live?: unknown;
  identity?: unknown;
  recipient?: { id: number; email: string; name: string | null; company: string | null; position: string | null; metadata?: unknown };
  campaign?: CampaignDetail;
} = {}) {
  const campaignRepository = {
    getCampaign: vi.fn().mockResolvedValue(overrides.campaign ?? campaign()),
  };
  const deliveryRepository = {
    getCampaignRecipient: vi.fn().mockResolvedValue({ recipientId: 5, status: EmailSendStatus.PENDING, sendCount: 0, metadata: overrides.metadata === undefined ? metadata() : overrides.metadata }),
    getRecipient: vi.fn().mockResolvedValue(overrides.recipient ?? { id: 5, email: "juan@iimp.org.pe", name: "Juan Pérez", company: null, position: null, metadata: null }),
    recoverStaleDeliveries: vi.fn().mockResolvedValue(0),
    hasInFlightDelivery: vi.fn().mockResolvedValue(false),
    claimRecipient: vi.fn().mockResolvedValue({ claimed: true, status: EmailSendStatus.SENDING, delivery: { id: 99, attemptNumber: 1 } }),
    createPendingDelivery: vi.fn().mockResolvedValue({ id: 99, attemptNumber: 1 }),
    markRecipientSending: vi.fn().mockResolvedValue(undefined),
    markDeliverySent: vi.fn().mockResolvedValue(undefined),
    markRecipientSent: vi.fn().mockResolvedValue(undefined),
    markDeliveryError: vi.fn().mockResolvedValue(undefined),
    markRecipientError: vi.fn().mockResolvedValue(undefined),
    markRecipientPending: vi.fn().mockResolvedValue(undefined),
    excludeClaimedDelivery: vi.fn().mockResolvedValue(undefined),
    writeAudit: vi.fn().mockResolvedValue(undefined),
  };
  const associateRepository = {
    getUserAccess: vi.fn().mockResolvedValue(overrides.live === undefined ? { id: 7, email: "juan@iimp.org.pe", status: UserStatus.ACTIVE, deletedAt: null, roleSlug: "ASOCIADO_ACTIVO" } : overrides.live),
    getAssociateIdentity: vi.fn().mockResolvedValue(overrides.identity ?? null),
  };
  const accountActivation = { createActivationUrl: vi.fn().mockResolvedValue({ email: "juan@iimp.org.pe", url: "https://portal/activar-cuenta?token=t" }) };
  const mailService = { sendMail: vi.fn().mockResolvedValue({ messageId: "<abc@example>" }), validateConfiguration: vi.fn() };

  const service = new CampaignMailService(
    campaignRepository as never,
    deliveryRepository as never,
    mailService as never,
    associateRepository as never,
    accountActivation as never,
  );

  return { service, campaignRepository, deliveryRepository, associateRepository, accountActivation, mailService };
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
    expect(deliveryRepository.excludeClaimedDelivery).not.toHaveBeenCalled();
  });

  it("excluye si el correo de acceso cambió tras preparar la campaña", async () => {
    const { service, deliveryRepository, mailService } = setup({
      live: { id: 7, email: "otro@iimp.org.pe", status: UserStatus.ACTIVE, deletedAt: null, roleSlug: "ASOCIADO_ACTIVO" },
    });
    const result = await service.deliverRecipient(campaign(), 1, 5);
    expect(result.outcome).toBe("ERROR");
    expect(deliveryRepository.excludeClaimedDelivery).toHaveBeenCalledWith(99, 1, 5, expect.stringContaining("cambió"));
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

    const manualCampaign: CampaignDetail = { ...campaign(), subject: "Hola {{nombre}}", htmlContent: "<p>{{nombre}}</p>" };
    const result = await service.deliverRecipient(manualCampaign, 1, 5);
    expect(result.outcome).toBe("RATE_LIMITED");
    expect(deliveryRepository.markRecipientPending).toHaveBeenCalledWith(1, 5);
    expect(deliveryRepository.markRecipientError).not.toHaveBeenCalled();
  });

  it("cuota diaria del proveedor devuelve QUOTA_EXCEEDED", async () => {
    const { service, deliveryRepository, mailService } = setup({ metadata: null });
    mailService.sendMail.mockRejectedValueOnce(new MailServiceError("Cuota diaria de envío del proveedor alcanzada.", "QUOTA_EXCEEDED"));

    const manualCampaign: CampaignDetail = { ...campaign(), subject: "Hola {{nombre}}", htmlContent: "<p>{{nombre}}</p>" };
    const result = await service.deliverRecipient(manualCampaign, 1, 5);
    expect(result.outcome).toBe("QUOTA_EXCEEDED");
    expect(deliveryRepository.markRecipientPending).toHaveBeenCalledWith(1, 5);
  });

  it("sendTest resuelve nombre_completo y correo_acceso del asociado de referencia", async () => {
    const { service, mailService } = setup();
    await service.sendTest(1, "prueba@iimp.org.pe", 5, { userId: 1, email: "admin@iimp.org.pe" });
    const call = mailService.sendMail.mock.calls[0][0];
    expect(call.html).toContain("Juan Pérez");
    expect(call.html).toContain("juan@iimp.org.pe");
    expect(call.html).toContain("Asociado Activo");
  });

  it("sendTest sin destinatario de referencia en campaña de asociados es rechazado (variable obligatoria)", async () => {
    const { service, mailService } = setup();
    await expect(service.sendTest(1, "prueba@iimp.org.pe", null, { userId: 1, email: "admin@iimp.org.pe" })).rejects.toMatchObject({ code: "MISSING_REQUIRED_VARIABLE" });
    expect(mailService.sendMail).not.toHaveBeenCalled();
  });

  it("deliverRecipient excluye asociados con nombre o correo de acceso vacíos", async () => {
    const { service, deliveryRepository, mailService } = setup({
      metadata: metadata({ nombreCompleto: "" }),
    });
    const result = await service.deliverRecipient(campaign(), 1, 5);
    expect(result.outcome).toBe("ERROR");
    expect(result.errorMessage).toContain("nombre_completo");
    expect(deliveryRepository.excludeClaimedDelivery).toHaveBeenCalled();
    expect(mailService.sendMail).not.toHaveBeenCalled();
  });

  it("reconstruye el contexto completo desde EmailRecipient.metadata cuando el snapshot es NULL (caso Ruth)", async () => {
    const { service, mailService, associateRepository } = setup({
      metadata: null,
      recipient: {
        id: 1253,
        email: "111683@unsaac.edu.pe",
        name: "RUTH NERY HUARCO GUTIERREZ",
        company: null,
        position: null,
        metadata: { source: "associates", userId: 1332, personId: 3548, tipoAsociado: "ESTUDIANTE", documentNumber: "73136694" },
      },
      identity: {
        userId: 1332,
        personId: 3548,
        email: "111683@unsaac.edu.pe",
        status: UserStatus.ACTIVE,
        deletedAt: null,
        roleSlug: "ASOCIADO_ESTUDIANTE",
        nombreCompleto: "RUTH NERY HUARCO GUTIERREZ",
        documentNumber: "73136694",
      },
    });

    const ruthCampaign: CampaignDetail = {
      ...campaign(),
      subject: "Hola {{nombre_completo}}",
      htmlContent: "<p>{{nombre_completo}} | {{correo_acceso}} | {{tipo_asociado}} | {{enlace_acceso}}</p>",
      textContent: "{{nombre_completo}} | {{correo_acceso}} | {{enlace_acceso}}",
    };

    const result = await service.deliverRecipient(ruthCampaign, 1, 1253);

    expect(result.outcome).toBe("SENT");
    expect(associateRepository.getAssociateIdentity).toHaveBeenCalledWith(1332);

    const sendArgs = mailService.sendMail.mock.calls[0][0];
    expect(sendArgs.to).toBe("111683@unsaac.edu.pe");
    expect(sendArgs.subject).toContain("RUTH NERY HUARCO GUTIERREZ");
    expect(sendArgs.html).toContain("RUTH NERY HUARCO GUTIERREZ");
    expect(sendArgs.html).toContain("111683@unsaac.edu.pe");
    expect(sendArgs.html).toContain("Asociado Estudiante");
    expect(sendArgs.html).toContain("/login");
    expect(sendArgs.text).toContain("RUTH NERY HUARCO GUTIERREZ");
    expect(sendArgs.text).toContain("111683@unsaac.edu.pe");
    expect(sendArgs.text).toContain("/login");
  });

  it("fallback: excluye si el asociado vinculado por userId ya no existe", async () => {
    const { service, deliveryRepository, mailService } = setup({
      metadata: null,
      recipient: { id: 5, email: "ruth@example.com", name: "Ruth", company: null, position: null, metadata: { source: "associates", userId: 1332 } },
      identity: null,
    });

    const result = await service.deliverRecipient(campaign(), 1, 5);
    expect(result.outcome).toBe("ERROR");
    expect(deliveryRepository.excludeClaimedDelivery).toHaveBeenCalled();
    expect(mailService.sendMail).not.toHaveBeenCalled();
  });

  it("fallback: excluye si la cuenta del asociado ya no está habilitada", async () => {
    const { service, mailService } = setup({
      metadata: null,
      recipient: { id: 5, email: "ruth@example.com", name: "Ruth", company: null, position: null, metadata: { source: "associates", userId: 1332 } },
      identity: {
        userId: 1332,
        personId: 3548,
        email: "ruth@example.com",
        status: UserStatus.INACTIVE,
        deletedAt: null,
        roleSlug: "ASOCIADO_ESTUDIANTE",
        nombreCompleto: "Ruth Huarco",
        documentNumber: null,
      },
    });

    const result = await service.deliverRecipient(campaign(), 1, 5);
    expect(result.outcome).toBe("ERROR");
    expect(mailService.sendMail).not.toHaveBeenCalled();
  });

  it("impide el envío cuando la variable obligatoria queda vacía (asociado sin nombre)", async () => {
    const { service, deliveryRepository, mailService } = setup({
      metadata: null,
      recipient: { id: 5, email: "ruth@example.com", name: null, company: null, position: null, metadata: { source: "associates", userId: 1332 } },
      identity: {
        userId: 1332,
        personId: 3548,
        email: "ruth@example.com",
        status: UserStatus.ACTIVE,
        deletedAt: null,
        roleSlug: "ASOCIADO_ESTUDIANTE",
        nombreCompleto: null,
        documentNumber: null,
      },
    });

    const result = await service.deliverRecipient(campaign(), 1, 5);
    expect(result.outcome).toBe("ERROR");
    expect(result.errorMessage).toContain("nombre_completo");
    expect(deliveryRepository.excludeClaimedDelivery).toHaveBeenCalled();
    expect(mailService.sendMail).not.toHaveBeenCalled();
  });

  it("impide el envío a un destinatario manual cuando la plantilla usa variables de asociado", async () => {
    const { service, deliveryRepository, mailService } = setup({
      metadata: null,
      recipient: { id: 5, email: "manual@example.com", name: "Manual", company: null, position: null, metadata: null },
    });

    const result = await service.deliverRecipient(campaign(), 1, 5);
    expect(result.outcome).toBe("ERROR");
    expect(result.errorMessage).toContain("nombre_completo");
    expect(deliveryRepository.excludeClaimedDelivery).toHaveBeenCalled();
    expect(mailService.sendMail).not.toHaveBeenCalled();
  });

  it("excluye si el correo de acceso difiere del correo del destinatario (sin redirigir)", async () => {
    const { service, deliveryRepository, mailService } = setup({
      metadata: null,
      recipient: { id: 5, email: "antiguo@example.com", name: "Ruth Huarco", company: null, position: null, metadata: { source: "associates", userId: 1332 } },
      identity: {
        userId: 1332,
        personId: 3548,
        email: "nuevo@example.com",
        status: UserStatus.ACTIVE,
        deletedAt: null,
        roleSlug: "ASOCIADO_ESTUDIANTE",
        nombreCompleto: "RUTH NERY HUARCO GUTIERREZ",
        documentNumber: "73136694",
      },
    });

    const result = await service.deliverRecipient(campaign(), 1, 5);
    expect(result.outcome).toBe("ERROR");
    expect(result.errorMessage).toContain("cambió");
    expect(deliveryRepository.excludeClaimedDelivery).toHaveBeenCalled();
    expect(mailService.sendMail).not.toHaveBeenCalled();
  });

  it("sendTest no mintea ni invalida tokens de activación para cuentas PENDING", async () => {
    const { service, accountActivation } = setup({
      metadata: null,
      recipient: { id: 5, email: "ruth@example.com", name: "Ruth Huarco", company: null, position: null, metadata: { source: "associates", userId: 1332 } },
      identity: {
        userId: 1332,
        personId: 3548,
        email: "ruth@example.com",
        status: UserStatus.PENDING,
        deletedAt: null,
        roleSlug: "ASOCIADO_ESTUDIANTE",
        nombreCompleto: "RUTH NERY HUARCO GUTIERREZ",
        documentNumber: "73136694",
      },
    });

    await service.sendTest(1, "prueba@iimp.org.pe", 5, { userId: 1, email: "admin@iimp.org.pe" });

    expect(accountActivation.createActivationUrl).not.toHaveBeenCalled();
  });

  it("campaña manual con {{nombre}} conserva el nombre genérico pese al vínculo de asociado", async () => {
    const { service, mailService } = setup({
      metadata: null,
      recipient: { id: 5, email: "ruth@example.com", name: "Ruth Huarco", company: null, position: null, metadata: { source: "associates", userId: 1332 } },
      identity: {
        userId: 1332,
        personId: 3548,
        email: "ruth@example.com",
        status: UserStatus.ACTIVE,
        deletedAt: null,
        roleSlug: "ASOCIADO_ESTUDIANTE",
        nombreCompleto: "RUTH NERY HUARCO GUTIERREZ",
        documentNumber: "73136694",
      },
    });

    const manualCampaign: CampaignDetail = {
      ...campaign(),
      subject: "Hola {{nombre}}",
      htmlContent: "<p>{{nombre}}</p>",
      textContent: "{{nombre}}",
    };

    const result = await service.deliverRecipient(manualCampaign, 1, 5);
    expect(result.outcome).toBe("SENT");
    const sendArgs = mailService.sendMail.mock.calls[0][0];
    expect(sendArgs.subject).toBe("Hola Ruth Huarco");
    expect(sendArgs.html).toContain("Ruth Huarco");
  });
});
