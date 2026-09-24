import { beforeEach, describe, expect, it, vi } from "vitest";

const sendMail = vi.hoisted(() => vi.fn());

vi.mock("@/modules/shared/Services/MailService", () => ({
  MailService: class { sendMail = sendMail; },
}));

import { NotifyApplicantService } from "./NotifyApplicantService";

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
});
