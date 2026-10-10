import { beforeEach, describe, expect, it, vi } from "vitest";

const sendMail = vi.hoisted(() => vi.fn());
const findUnique = vi.hoisted(() => vi.fn());
const resolveAttachment = vi.hoisted(() => vi.fn());

vi.mock("@/modules/shared/Services/MailService", () => ({
  MailService: class { sendMail = sendMail; },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { membershipApplication: { findUnique: findUnique } },
}));

vi.mock("@/modules/afiliaciones/observations/ObservationFields", () => ({
  OBSERVATION_FIELDS: [{ key: "personalInformation.phone", label: "Celular" }],
}));

vi.mock("@/modules/afiliaciones/expedientes/Services/StatusChangeAttachmentService", () => ({
  StatusChangeAttachmentService: class { resolve = resolveAttachment; },
  StatusChangeAttachmentError: class extends Error {},
}));

import { NotifyApplicantService } from "./NotifyApplicantService";

describe("NotifyApplicantService.notifyObservationCreated", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://afiliaciones-qa.iimp.org.pe");
    findUnique.mockResolvedValue({
      id: 26,
      email: "postulante@example.com",
      person: { firstName: "Roiser", paternalLastName: "Ejemplo" },
      draftData: null,
    });
    sendMail.mockResolvedValue(undefined);
  });

  it("envía el correo sin adjuntos cuando no hay referencia de archivo", async () => {
    await new NotifyApplicantService().notifyObservationCreated(26, "Falta constancia", ["personalInformation.phone"]);

    const options = sendMail.mock.calls[0][0];
    expect(options.attachments).toBeUndefined();
    expect(resolveAttachment).not.toHaveBeenCalled();
  });

  it("adjunta el documento real cuando se proporciona la referencia", async () => {
    resolveAttachment.mockResolvedValue([
      { filename: "evidencia.pdf", content: Buffer.from("PDF"), contentType: "application/pdf" },
    ]);

    const attachment = {
      applicationId: 26,
      attachmentUrl: "afiliaciones/applications/26/observations/evidencia.pdf",
      attachmentName: "evidencia.pdf",
      mimeType: "application/pdf",
    };

    await new NotifyApplicantService().notifyObservationCreated(26, "Falta constancia", ["personalInformation.phone"], attachment);

    expect(resolveAttachment).toHaveBeenCalledWith(attachment);
    const options = sendMail.mock.calls[0][0];
    expect(options.attachments).toEqual([
      { filename: "evidencia.pdf", content: Buffer.from("PDF"), contentType: "application/pdf" },
    ]);
  });

  it("no envía un correo incompleto cuando falla la recuperación del adjunto", async () => {
    resolveAttachment.mockRejectedValue(new Error("No se pudo descargar el documento desde S3."));

    await new NotifyApplicantService().notifyObservationCreated(26, "Falta constancia", ["personalInformation.phone"], {
      applicationId: 26,
      attachmentUrl: "afiliaciones/applications/26/observations/evidencia.pdf",
      attachmentName: "evidencia.pdf",
      mimeType: "application/pdf",
    });

    expect(sendMail).not.toHaveBeenCalled();
  });
});
