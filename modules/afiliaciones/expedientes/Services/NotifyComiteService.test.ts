import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sendMail: vi.fn(),
  getObjectBuffer: vi.fn(),
  generatePdf: vi.fn(),
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

vi.mock("@/modules/afiliaciones/postulacion/Services/DeclarationPdfService", () => ({
  DeclarationPdfService: class {
    generate = mocks.generatePdf;
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
    process.env.JWT_SECRET = "test-comite-secret";
    mocks.findApplication.mockResolvedValue(application());
    mocks.findUsers.mockResolvedValue([
      { id: 99, email: "comite@iimp.org.pe", person: { firstName: "Comité", paternalLastName: "Uno" } },
    ]);
    mocks.getObjectBuffer.mockResolvedValue(Buffer.from("%PDF-FIRMADO"));
    mocks.generatePdf.mockResolvedValue(new Uint8Array(Buffer.from("%PDF-GENERADO")));
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
      ["afiliaciones/applications/7", "afiliaciones/legacy/documents"],
    );

    const mail = mocks.sendMail.mock.calls[0][0];
    expect(mail.attachments[0].filename).toBe("Declaracion_Jurada_Firmada_APP-7.pdf");
    expect(mail.attachments[0].content.toString()).toBe("%PDF-FIRMADO");
    expect(mail.html).toContain("APROBAR");
    expect(mail.html).toContain("RECHAZAR");
    expect(mail.html).toContain("/postulacion/comite/revisar?token=");
    expect(mail.html).toContain("decision=APPROVE");
    expect(mail.html).toContain("decision=REJECT");
    expect(mail.html).toContain("Declaración Jurada firmada");
  });

  it("lee la declaración firmada de expedientes legacy desde su prefijo permitido", async () => {
    mocks.findDocument.mockResolvedValue({
      fileUrl: "afiliaciones/legacy/documents/firmada.pdf",
    });

    await new NotifyComiteService().execute(7, true);

    expect(mocks.getObjectBuffer).toHaveBeenCalledWith(
      "afiliaciones/legacy/documents/firmada.pdf",
      ["afiliaciones/applications/7", "afiliaciones/legacy/documents"],
    );
    expect(mocks.generatePdf).not.toHaveBeenCalled();
    expect(mocks.sendMail.mock.calls[0][0].attachments[0].filename).toBe(
      "Declaracion_Jurada_Firmada_APP-7.pdf",
    );
  });

  it("usa la declaración generada cuando el expediente legacy no tiene una firmada", async () => {
    mocks.findDocument.mockResolvedValue(null);

    await new NotifyComiteService().execute(7, true);

    expect(mocks.getObjectBuffer).not.toHaveBeenCalled();
    expect(mocks.generatePdf).toHaveBeenCalled();

    const mail = mocks.sendMail.mock.calls[0][0];
    expect(mail.attachments[0].filename).toBe("Declaracion_Jurada_APP-7.pdf");
    expect(mail.attachments[0].content.toString()).toBe("%PDF-GENERADO");
    expect(mail.html).toContain("Declaración Jurada registrada");
    expect(mail.html).toContain("APROBAR");
    expect(mail.html).toContain("RECHAZAR");
  });
});
