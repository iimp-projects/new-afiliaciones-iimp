import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sendMail: vi.fn(),
  findApplication: vi.fn(),
}));

vi.mock("@/modules/shared/Services/MailService", () => ({
  MailService: class { sendMail = mocks.sendMail; },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    membershipApplication: { findFirst: mocks.findApplication },
  },
}));

import { NotifyApplicantService } from "./NotifyApplicantService";
const sendMail = mocks.sendMail;

const application = {
  trackingCode: "uuid-interno-1234567890",
  applicationCode: "EXP-001",
  email: "postulante@example.com",
};

const draft = {
  personalInformation: {
    primaryEmail: "postulante@example.com",
    names: "Juan",
    fatherLastName: "Perez",
    motherLastName: "Gomez",
  },
};

describe("NotifyApplicantService — no expone el código de seguimiento", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://afiliaciones-qa.iimp.org.pe");
    sendMail.mockResolvedValue(undefined);
  });

  it("correo de confirmación no muestra trackingCode ni instrucción de código", async () => {
    await new NotifyApplicantService().execute(application as never, draft as never);

    const { html, subject } = sendMail.mock.calls[0][0];
    expect(subject).toContain("Confirmación de Solicitud");
    expect(html).not.toContain(application.trackingCode);
    expect(html).not.toContain("Código de Seguimiento");
    expect(html).not.toContain("Código de Verificación");
    expect(html).not.toContain("código asignado");
    expect(html).toContain("tipo de documento, número de documento y correo registrado");
    expect(html).toContain("Consultar Estado de Solicitud");
  });

  it("correo de subsanación no muestra trackingCode", async () => {
    await new NotifyApplicantService().notifyCorrectionReceived(application as never, draft);

    const { html } = sendMail.mock.calls[0][0];
    expect(html).not.toContain(application.trackingCode);
    expect(html).not.toContain("Código de Seguimiento");
    expect(html).toContain("Consultar Estado de Solicitud");
  });

  it("adjunta exactamente el buffer firmado recibido (no lo regenera)", async () => {
    const signedBuffer = Buffer.from("SIGNED_DECLARATION");
    await new NotifyApplicantService().execute(application as never, draft as never, signedBuffer);

    const { attachments, html } = sendMail.mock.calls[0][0];
    expect(attachments).toHaveLength(1);
    expect(attachments[0].content.toString()).toBe("SIGNED_DECLARATION");
    expect(attachments[0].contentType).toBe("application/pdf");
    expect(attachments[0].filename).toContain("Firmada");
    expect(html).toContain("Declaración Jurada firmada");
  });

  it("envía el correo sin adjunto cuando no hay buffer firmado", async () => {
    await new NotifyApplicantService().execute(application as never, draft as never);

    const { attachments } = sendMail.mock.calls[0][0];
    expect(attachments).toEqual([]);
  });

  describe("resendConfirmation", () => {
    it("reenvía la confirmación al correo registrado", async () => {
      mocks.findApplication.mockResolvedValue({
        id: 26,
        email: "postulante@example.com",
        deletedAt: null,
        draftData: draft,
        person: { firstName: "Juan", paternalLastName: "Perez" },
      });

      await expect(new NotifyApplicantService().resendConfirmation(26)).resolves.toEqual({ sent: true });

      const mail = sendMail.mock.calls[0][0];
      expect(mail.to).toBe("postulante@example.com");
      expect(mail.subject).toContain("Confirmación de Solicitud");
      expect(mail.html).toContain("Juan Perez");
      expect(mail.html).not.toContain(application.trackingCode);
    });

    it("no reenvía si la solicitud no existe", async () => {
      mocks.findApplication.mockResolvedValue(null);
      await expect(new NotifyApplicantService().resendConfirmation(26)).resolves.toEqual({
        sent: false,
        reason: "NOT_FOUND",
      });
      expect(sendMail).not.toHaveBeenCalled();
    });

    it("no reenvía si no hay correo registrado", async () => {
      mocks.findApplication.mockResolvedValue({
        id: 26,
        email: null,
        deletedAt: null,
        draftData: { personalInformation: {} },
        person: null,
      });
      await expect(new NotifyApplicantService().resendConfirmation(26)).resolves.toEqual({
        sent: false,
        reason: "NO_EMAIL",
      });
      expect(sendMail).not.toHaveBeenCalled();
    });
  });
});
