import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { ExportExpedientesService } from "./ExportExpedientesService";
import type { ExpedienteRepository } from "../Repositories/ExpedienteRepository";

const makeRecord = (overrides: Record<string, unknown> = {}) => ({
  trackingCode: "APP-001",
  applicationCode: "COD-001",
  documentType: "DNI",
  documentNumber: "12345678",
  email: "postulante@example.com",
  phone: "999999999",
  affiliateType: "ACTIVE",
  status: "PENDING",
  createdAt: new Date("2026-01-01T10:00:00.000Z"),
  updatedAt: new Date("2026-01-02T10:00:00.000Z"),
  person: {
    firstName: "Juan",
    paternalLastName: "Perez",
    maternalLastName: "Garcia",
  },
  payments: [{ status: "PENDING" }],
  approvals: [
    { status: "APPROVED" },
    { status: "APPROVED" },
  ],
  validations: [
    { department: { code: "LOGISTICA" }, status: "APPROVED" },
    { department: { code: "ASOCIADOS" }, status: "APPROVED" },
  ],
  ...overrides,
});

describe("ExportExpedientesService", () => {
  it("genera un workbook con los registros filtrados", async () => {
    const repository = {
      getAllFiltered: async () => [makeRecord()],
    } as unknown as ExpedienteRepository;

    const service = new ExportExpedientesService(repository);
    const buffer = await service.execute({});

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);

    const worksheet = workbook.getWorksheet("Expedientes")!;
    expect(worksheet.getRow(1).getCell(1).value).toBe("Código");
    expect(worksheet.rowCount).toBe(2);
    expect(worksheet.getRow(2).getCell(4).value).toBe("Juan Perez Garcia");
  });

  it("aplica el filtro del Comité Evaluador y excluye expedientes no listos", async () => {
    const repository = {
      getAllFiltered: async () => [
        makeRecord(),
        makeRecord({ validations: [{ department: { code: "LOGISTICA" }, status: "PENDING" }] }),
        makeRecord({ approvals: [{ status: "PENDING" }] }),
      ],
    } as unknown as ExpedienteRepository;

    const service = new ExportExpedientesService(repository);
    const buffer = await service.execute({}, { isComite: true });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);

    const worksheet = workbook.getWorksheet("Expedientes")!;
    expect(worksheet.rowCount).toBe(2);
  });

  it("no aplica el filtro del Comité para otros roles", async () => {
    const repository = {
      getAllFiltered: async () => [
        makeRecord(),
        makeRecord({ validations: [{ department: { code: "LOGISTICA" }, status: "PENDING" }] }),
      ],
    } as unknown as ExpedienteRepository;

    const service = new ExportExpedientesService(repository);
    const buffer = await service.execute({});

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);

    const worksheet = workbook.getWorksheet("Expedientes")!;
    expect(worksheet.rowCount).toBe(3);
  });
});
