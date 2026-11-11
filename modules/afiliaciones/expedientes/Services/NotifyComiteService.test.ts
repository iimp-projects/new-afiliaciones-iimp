import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sendMail: vi.fn(),
  getObjectBuffer: vi.fn(),
  findApplication: vi.fn(),
  findDocument: vi.fn(),
  findUsers: vi.fn(),
  createHistory: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    membershipApplication: { findUnique: mocks.findApplication },
    applicationDocument: { findFirst: mocks.findDocument },
    user: { findMany: mocks.findUsers },
    membershipValidationHistory: { create: mocks.createHistory },
  },
}));

vi.mock("@/modules/shared/Services/MailService", () => ({
  MailService: class {
    sendMail = mocks.sendMail;
  },
}));

vi.mock("@/modules/shared/Services/S3StorageService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/shared/Services/S3StorageService")>();
  return {
    ...actual,
    S3StorageService: class {
      getObjectBuffer = mocks.getObjectBuffer;
    },
  };
});

import { NotifyComiteService } from "./NotifyComiteService";

function application() {
  return {
    id: 7,
    applicationCode: "APP-7",
    affiliateType: "ACTIVE",
    draftData: {},
    person: { firstName: "Ana", paternalLastName: "Pérez" },
    approvals: [
      { status: "APPROVED", sponsorPerson: { firstName: "Aval", paternalLastName: "Uno" } },
      { status: "APPROVED", sponsorPerson: { firstName: "Aval", paternalLastName: "Dos" } },
    ],
    validations: [
      {
        id: 11,
        status: "APPROVED",
        department: { code: "LOGISTICA" },
        validatedBy: { person: { firstName: "Log", paternalLastName: "Uno" } },
      },
      {
        id: 12,
        status: "APPROVED",
        department: { code: "ASOCIADOS" },
        validatedBy: { person: { firstName: "Asoc", paternalLastName: "Uno" } },
      },
      { id: 13, status: "PENDING", department: { code: "COMITE" }, validatedBy: null },
    ],
  };
}

describe("NotifyComiteService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findApplication.mockResolvedValue(application());
    mocks.findUsers.mockResolvedValue([
      { email: "comite@iimp.org.pe", person: { firstName: "Comité", paternalLastName: "Uno" } },
    ]);
    mocks.getObjectBuffer.mockResolvedValue(Buffer.from("%PDF-FIRMADO"));
  });

  it("adjunta la declaración jurada firmada y el botón de ingreso al portal", async () => {
    mocks.findDocument.mockResolvedValue({
      fileUrl: "afiliaciones/applications/7/declarations/firmada.pdf",
    });

    await new NotifyComiteService().execute(7);

    expect(mocks.findDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { applicationId: 7, category: "SWORN_DECLARATION" },
      }),
    );
    expect(mocks.getObjectBuffer).toHaveBeenCalledWith(
      "afiliaciones/applications/7/declarations/firmada.pdf",
      ["afiliaciones/applications/7"],
    );

    const mail = mocks.sendMail.mock.calls[0][0];
    expect(mail.attachments[0].filename).toBe("Declaracion_Jurada_Firmada_APP-7.pdf");
    expect(mail.attachments[0].content.toString()).toBe("%PDF-FIRMADO");
    expect(mail.html).toContain("INGRESAR AL PORTAL");
    expect(mail.html).toContain("/login");
    expect(mail.html).toContain("Declaración Jurada firmada");
  });

  it("no envía el correo si no existe la declaración jurada firmada", async () => {
    mocks.findDocument.mockResolvedValue(null);

    await expect(new NotifyComiteService().execute(7, true)).rejects.toThrow(
      "Declaración Jurada firmada",
    );

    expect(mocks.getObjectBuffer).not.toHaveBeenCalled();
    expect(mocks.sendMail).not.toHaveBeenCalled();
  });
});
