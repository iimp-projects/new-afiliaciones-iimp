import { beforeEach, describe, expect, it, vi } from "vitest";

const sendMail = vi.hoisted(() => vi.fn());
const findManyApprovals = vi.hoisted(() => vi.fn());
const generatePdf = vi.hoisted(() => vi.fn());

vi.mock("@/modules/shared/Services/MailService", () => ({
  MailService: class { sendMail = sendMail; },
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { membershipApproval: { findMany: findManyApprovals } },
}));
vi.mock("./DeclarationPdfService", () => ({
  DeclarationPdfService: class { generate = generatePdf; },
}));

import { NotifySponsorsService } from "./NotifySponsorsService";

const UUID = "uuid-sensible-1234567890abcdef";

describe("NotifySponsorsService — no expone el código de seguimiento", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("JWT_SECRET", "test-secret-for-sponsor-emails");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://afiliaciones-qa.iimp.org.pe");
    sendMail.mockResolvedValue(undefined);
  });

  it("correo de confirmación de reemplazo de aval no expone el trackingCode", async () => {
    await new NotifySponsorsService().sendApplicantReplacementConfirmation({
      applicantEmail: "postulante@example.com",
      applicantName: "Postulante IIMP",
      newSponsorFullName: "Aval Ejemplo",
      trackingCode: UUID,
    });

    const { subject, html } = sendMail.mock.calls[0][0];
    expect(subject).not.toContain(UUID);
    expect(subject).not.toContain("Código");
    expect(html).not.toContain(UUID);
    expect(html).not.toContain("Código de Seguimiento");
    expect(html).toContain("Aval Ejemplo");
  });

  it("correo al aval (notificación individual) no expone el código de seguimiento", async () => {
    await new NotifySponsorsService().sendSingleSponsorNotification({
      applicationId: 7,
      sponsorPersonId: 42,
      sponsorEmail: "aval@example.com",
      sponsorFullName: "Aval Ejemplo",
      applicantName: "Postulante IIMP",
      draft: undefined as never,
    });

    const { html } = sendMail.mock.calls[0][0];
    expect(html).not.toContain(UUID);
    expect(html).not.toContain("Código de Seguimiento");
    expect(html).toContain("Aval Ejemplo");
    expect(html).toContain("Revisar y Validar Postulación");
  });
});

describe("NotifySponsorsService.execute — usa la declaración firmada", () => {
  const application = { id: 7, applicationCode: "EXP-001" } as never;
  const draft = {
    membershipType: "ACTIVE",
    personalInformation: { names: "Juan", fatherLastName: "Perez" },
  } as never;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("JWT_SECRET", "test-secret-for-sponsor-emails");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://afiliaciones-qa.iimp.org.pe");
    sendMail.mockResolvedValue(undefined);
    generatePdf.mockResolvedValue(new Uint8Array(Buffer.from("GENERATED_UNSIGNED_PDF")));
    findManyApprovals.mockResolvedValue([
      { sponsorPerson: { firstName: "Aval", paternalLastName: "Ejemplo", maternalLastName: "", user: { email: "aval@example.com" }, contacts: [] } },
    ]);
  });

  it("adjunta el buffer firmado recibido y NO regenera el PDF", async () => {
    const signedBuffer = Buffer.from("SIGNED_DECLARATION");
    await new NotifySponsorsService().execute(application, draft, signedBuffer);

    expect(generatePdf).not.toHaveBeenCalled();

    const { attachments } = sendMail.mock.calls[0][0];
    expect(attachments).toHaveLength(1);
    expect(attachments[0].content.toString()).toBe("SIGNED_DECLARATION");
    expect(attachments[0].filename).toContain("Firmada");
  });

  it("no regenera el PDF cuando no hay buffer firmado (sin adjunto)", async () => {
    await new NotifySponsorsService().execute(application, draft);

    expect(generatePdf).not.toHaveBeenCalled();
    const { attachments } = sendMail.mock.calls[0][0];
    expect(attachments).toEqual([]);
  });
});
