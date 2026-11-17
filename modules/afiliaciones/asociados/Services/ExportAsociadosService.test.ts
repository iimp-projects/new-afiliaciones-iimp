import { beforeEach, describe, expect, it, vi } from "vitest";
import ExcelJS from "exceljs";
import { ExportAsociadosService } from "./ExportAsociadosService";

const mocks = vi.hoisted(() => ({
  appFindMany: vi.fn(),
  sieFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    membershipApplication: { findMany: mocks.appFindMany },
    sieAssociateRecord: { findMany: mocks.sieFindMany },
  },
}));

const postulacionRecord = {
  documentType: "DNI",
  documentNumber: "12345678",
  email: "postulante@example.com",
  affiliateType: "ACTIVE",
  createdAt: new Date("2026-01-01T10:00:00.000Z"),
  updatedAt: new Date("2026-01-02T10:00:00.000Z"),
  draftData: {},
  documents: [
    {
      category: "ID_DOCUMENT",
      fileUrl: "afiliaciones/applications/1/documents/dni.pdf",
      fileName: "dni.pdf",
      mimeType: "application/pdf",
      createdAt: new Date("2026-01-01T10:00:00.000Z"),
      updatedAt: new Date("2026-01-02T10:00:00.000Z"),
    },
  ],
  approvals: [
    {
      sponsorPerson: {
        firstName: "Ana",
        paternalLastName: "Torres",
        maternalLastName: "Ríos",
        contacts: [{ isPrimary: true, phoneNumber: "987654321", email: "ana@example.com" }],
        user: { email: "ana.user@example.com" },
      },
    },
  ],
  validations: [
    {
      department: { code: "ASOCIADOS" },
      validatedBy: {
        person: { firstName: "Carla", paternalLastName: "Núñez", maternalLastName: "Soto" },
      },
    },
  ],
  person: {
    firstName: "Juan",
    paternalLastName: "Perez",
    maternalLastName: "Garcia",
    contacts: [{ isPrimary: true, phoneNumber: "999999999" }],
    user: { email: "juan@example.com", status: "ACTIVE" },
    sieAssociateRecords: [{ externalCode: "IIMP-001", category: { mappedAffiliateType: "ACTIVE" } }],
    applications: [],
  },
};

const historicoRecord = {
  externalCode: "SIE-999",
  updatedAt: new Date("2025-06-01T10:00:00.000Z"),
  category: { mappedAffiliateType: "STUDENT" },
  person: {
    documentType: "DNI",
    documentNumber: "87654321",
    firstName: "Maria",
    paternalLastName: "Lopez",
    maternalLastName: null,
    createdAt: new Date("2025-01-01T10:00:00.000Z"),
    contacts: [{ isPrimary: true, phoneNumber: "988888888" }],
    user: { email: "maria@example.com", status: "ACTIVE" },
  },
};

async function loadWorkbook(buffer: Buffer): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  return workbook;
}

async function loadWorksheet(buffer: Buffer): Promise<ExcelJS.Worksheet> {
  return (await loadWorkbook(buffer)).getWorksheet("Padrón de Asociados")!;
}

describe("ExportAsociadosService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.appFindMany.mockResolvedValue([]);
    mocks.sieFindMany.mockResolvedValue([]);
  });

  it("genera un workbook con el padrón combinando ambas fuentes", async () => {
    mocks.appFindMany.mockResolvedValue([postulacionRecord]);
    mocks.sieFindMany.mockResolvedValue([historicoRecord]);

    const service = new ExportAsociadosService();
    const worksheet = await loadWorksheet(await service.execute({}));
    const headers = (worksheet.getRow(1).values as unknown[]).filter(Boolean) as string[];

    expect(worksheet.getRow(1).getCell(1).value).toBe("Código Institucional");
    expect(worksheet.rowCount).toBe(3);
    expect(worksheet.getRow(2).getCell(4).value).toBe("Juan Perez Garcia");
    expect(worksheet.getRow(3).getCell(headers.indexOf("Origen") + 1).value).toBe("SIE Histórico");
  });

  it("aplica los filtros de búsqueda y tipo de membresía a la consulta", async () => {
    const service = new ExportAsociadosService();
    await service.execute({ search: "Perez", membershipType: "ACTIVE", sort: "asc" });

    const appWhere = mocks.appFindMany.mock.calls[0][0].where;
    expect(appWhere.affiliateType).toBe("ACTIVE");
    expect(appWhere.OR).toBeDefined();

    const sieWhere = mocks.sieFindMany.mock.calls[0][0].where;
    expect(sieWhere.category).toEqual({ mappedAffiliateType: "ACTIVE" });
    expect(sieWhere.OR).toBeDefined();
  });

  it("excluye registros históricos sin persona", async () => {
    mocks.sieFindMany.mockResolvedValue([{ ...historicoRecord, person: null }]);

    const service = new ExportAsociadosService();
    const worksheet = await loadWorksheet(await service.execute({}));

    expect(worksheet.rowCount).toBe(1);
  });

  it("incluye avales, revisor y documentos con su propio enlace", async () => {
    mocks.appFindMany.mockResolvedValue([postulacionRecord]);

    const service = new ExportAsociadosService();
    const workbook = await loadWorkbook(await service.execute({}));
    const worksheet = workbook.getWorksheet("Padrón de Asociados")!;
    const headers = (worksheet.getRow(1).values as unknown[]).filter(Boolean) as string[];
    const row = worksheet.getRow(2);

    expect(row.getCell(headers.indexOf("Aval 1 Nombre") + 1).value).toBe("Torres Ríos, Ana");
    expect(row.getCell(headers.indexOf("Aval 1 Celular") + 1).value).toBe("987654321");
    expect(row.getCell(headers.indexOf("Aval 1 Correo") + 1).value).toBe("ana@example.com");
    expect(row.getCell(headers.indexOf("Revisor Asociados") + 1).value).toBe("Núñez Soto, Carla");
    expect(row.getCell(headers.indexOf("Documento de Identidad") + 1).value).toMatchObject({
      text: expect.stringContaining("/api/afiliaciones/postulacion/file?"),
      hyperlink: expect.stringContaining("redirect=1"),
    });

    const documentsSheet = workbook.getWorksheet("Documentos");
    expect(documentsSheet).toBeDefined();
    expect(documentsSheet!.rowCount).toBe(2);
    expect(documentsSheet!.getRow(2).getCell(2).value).toBe("Documento de Identidad");
    expect(documentsSheet!.getRow(2).getCell(5).value).toMatchObject({
      text: expect.stringContaining("/api/afiliaciones/postulacion/file?"),
      hyperlink: expect.stringContaining("redirect=1"),
    });
  });
});
