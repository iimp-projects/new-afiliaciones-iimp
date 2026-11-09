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

async function loadWorkbook(buffer: Buffer): Promise<ExcelJS.Worksheet> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  return workbook.getWorksheet("Padrón de Asociados")!;
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
    const buffer = await service.execute({});

    const worksheet = await loadWorkbook(buffer);
    expect(worksheet.getRow(1).getCell(1).value).toBe("Código Institucional");
    expect(worksheet.rowCount).toBe(3);
    expect(worksheet.getRow(2).getCell(4).value).toBe("Juan Perez Garcia");
    expect(worksheet.getRow(3).getCell(9).value).toBe("SIE Histórico");
  });

  it("aplica los filtros de búsqueda y tipo de membresía a la consulta", async () => {
    mocks.appFindMany.mockResolvedValue([]);
    mocks.sieFindMany.mockResolvedValue([]);

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
    mocks.appFindMany.mockResolvedValue([]);
    mocks.sieFindMany.mockResolvedValue([{ ...historicoRecord, person: null }]);

    const service = new ExportAsociadosService();
    const buffer = await service.execute({});

    const worksheet = await loadWorkbook(buffer);
    expect(worksheet.rowCount).toBe(1);
  });
});
