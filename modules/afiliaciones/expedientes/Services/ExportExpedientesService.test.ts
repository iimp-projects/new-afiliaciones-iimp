import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { ExportExpedientesService } from "./ExportExpedientesService";
import type { ExpedienteRepository } from "../Repositories/ExpedienteRepository";

const makeRecord = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
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
  draftData: {},
  documents: [],
  person: {
    firstName: "Juan",
    paternalLastName: "Perez",
    maternalLastName: "Garcia",
  },
  payments: [{ status: "PENDING" }],
  approvals: [{ status: "APPROVED" }, { status: "APPROVED" }],
  validations: [
    { department: { code: "LOGISTICA" }, status: "APPROVED" },
    { department: { code: "ASOCIADOS" }, status: "APPROVED" },
  ],
  ...overrides,
});

async function loadWorkbook(buffer: Buffer): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  return workbook;
}

describe("ExportExpedientesService", () => {
  it("genera un workbook con los registros filtrados", async () => {
    const repository = {
      getAllFiltered: async () => [makeRecord()],
    } as unknown as ExpedienteRepository;

    const service = new ExportExpedientesService(repository);
    const workbook = await loadWorkbook(await service.execute({}));

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
    const workbook = await loadWorkbook(await service.execute({}, { isComite: true }));

    expect(workbook.getWorksheet("Expedientes")!.rowCount).toBe(2);
  });

  it("no aplica el filtro del Comité para otros roles", async () => {
    const repository = {
      getAllFiltered: async () => [
        makeRecord(),
        makeRecord({ validations: [{ department: { code: "LOGISTICA" }, status: "PENDING" }] }),
      ],
    } as unknown as ExpedienteRepository;

    const service = new ExportExpedientesService(repository);
    const workbook = await loadWorkbook(await service.execute({}));

    expect(workbook.getWorksheet("Expedientes")!.rowCount).toBe(3);
  });

  it("incluye la última versión corregida del documento en la hoja Expedientes", async () => {
    const repository = {
      getAllFiltered: async () => [
        makeRecord({
          draftData: {
            personalInformation: {
              identityDocument: {
                url: "afiliaciones/applications/1/documents/dni-corregido.pdf",
                name: "dni-corregido.pdf",
                type: "application/pdf",
              },
            },
          },
          documents: [
            {
              category: "ID_DOCUMENT",
              fileUrl: "afiliaciones/applications/1/documents/dni-old.pdf",
              fileName: "dni-old.pdf",
              mimeType: "application/pdf",
              createdAt: new Date("2026-01-01T10:00:00.000Z"),
              updatedAt: new Date("2026-01-01T10:00:00.000Z"),
            },
          ],
        }),
      ],
    } as unknown as ExpedienteRepository;

    const service = new ExportExpedientesService(repository);
    const workbook = await loadWorkbook(await service.execute({}));
    const worksheet = workbook.getWorksheet("Expedientes")!;
    const header = worksheet.getRow(1).values as unknown[];
    const column = header.indexOf("Documento de Identidad");

    expect(column).toBeGreaterThan(0);
    expect(worksheet.getRow(2).getCell(column).value).toMatchObject({
      text: expect.stringContaining("/api/afiliaciones/postulacion/file?"),
      hyperlink: expect.stringContaining("redirect=1"),
    });
  });

  it("agrega la hoja Documentos con los enlaces vigentes", async () => {
    const repository = {
      getAllFiltered: async () => [
        makeRecord({
          documents: [
            {
              category: "CV",
              fileUrl: "afiliaciones/applications/1/documents/cv.pdf",
              fileName: "cv.pdf",
              mimeType: "application/pdf",
              createdAt: new Date("2026-01-01T10:00:00.000Z"),
              updatedAt: new Date("2026-01-02T10:00:00.000Z"),
            },
          ],
        }),
      ],
    } as unknown as ExpedienteRepository;

    const service = new ExportExpedientesService(repository);
    const workbook = await loadWorkbook(await service.execute({}));
    const sheet = workbook.getWorksheet("Documentos");

    expect(sheet).toBeDefined();
    expect(sheet!.rowCount).toBe(2);
    expect(sheet!.getRow(2).getCell(2).value).toBe("CV");
    const linkCell = sheet!.getRow(2).getCell(5).value as { text: string; hyperlink: string };
    expect(linkCell.text).toContain("/api/afiliaciones/postulacion/file?");
    expect(linkCell.text).toBe(linkCell.hyperlink);
  });

  it("incluye avales, revisor por área y omite Asesoría Legal/Comunicaciones", async () => {
    const repository = {
      getAllFiltered: async () => [
        makeRecord({
          approvals: [
            {
              status: "APPROVED",
              sponsorPerson: {
                firstName: "Ana",
                paternalLastName: "Torres",
                maternalLastName: "Ríos",
                contacts: [
                  { isPrimary: true, phoneNumber: "987654321", email: "ana@example.com" },
                ],
                user: { email: "ana.user@example.com" },
              },
            },
            {
              status: "APPROVED",
              sponsorPerson: {
                firstName: "Luis",
                paternalLastName: "Mendoza",
                maternalLastName: null,
                contacts: [
                  { isPrimary: false, phoneNumber: "912345678", email: "luis@example.com" },
                ],
                user: null,
              },
            },
          ],
          validations: [
            {
              department: { code: "ASOCIADOS" },
              status: "APPROVED",
              validatedBy: {
                person: { firstName: "Carla", paternalLastName: "Núñez", maternalLastName: "Soto" },
              },
            },
            {
              department: { code: "LOGISTICA" },
              status: "APPROVED",
              validatedBy: {
                person: { firstName: "Pedro", paternalLastName: "Quispe", maternalLastName: null },
              },
            },
            {
              department: { code: "COMITE" },
              status: "PENDING",
              validatedBy: null,
            },
          ],
        }),
      ],
    } as unknown as ExpedienteRepository;

    const service = new ExportExpedientesService(repository);
    const workbook = await loadWorkbook(await service.execute({}));
    const sheet = workbook.getWorksheet("Expedientes")!;
    const headers = (sheet.getRow(1).values as unknown[]).filter(Boolean) as string[];
    const row = sheet.getRow(2);

    expect(headers).not.toContain("Asesoría Legal");
    expect(headers).not.toContain("Comunicaciones");
    expect(row.getCell(headers.indexOf("Aval 1 Nombre") + 1).value).toBe("Torres Ríos, Ana");
    expect(row.getCell(headers.indexOf("Aval 1 Celular") + 1).value).toBe("987654321");
    expect(row.getCell(headers.indexOf("Aval 1 Correo") + 1).value).toBe("ana@example.com");
    expect(row.getCell(headers.indexOf("Aval 2 Nombre") + 1).value).toBe("Mendoza, Luis");
    expect(row.getCell(headers.indexOf("Revisor Asociados") + 1).value).toBe("Núñez Soto, Carla");
    expect(row.getCell(headers.indexOf("Revisor Logística") + 1).value).toBe("Quispe, Pedro");
    expect(row.getCell(headers.indexOf("Revisor Comité") + 1).value).toBe("Sin revisor");
  });

  it("asigna un enlace propio a cada columna de documento", async () => {
    const repository = {
      getAllFiltered: async () => [
        makeRecord({
          documents: [
            {
              category: "ID_DOCUMENT",
              fileUrl: "afiliaciones/applications/1/documents/dni.pdf",
              fileName: "dni.pdf",
              mimeType: "application/pdf",
              createdAt: new Date("2026-01-01T10:00:00.000Z"),
              updatedAt: new Date("2026-01-02T10:00:00.000Z"),
            },
            {
              category: "CV",
              fileUrl: "afiliaciones/applications/1/documents/cv.pdf",
              fileName: "cv.pdf",
              mimeType: "application/pdf",
              createdAt: new Date("2026-01-01T10:00:00.000Z"),
              updatedAt: new Date("2026-01-02T10:00:00.000Z"),
            },
          ],
        }),
      ],
    } as unknown as ExpedienteRepository;

    const service = new ExportExpedientesService(repository);
    const workbook = await loadWorkbook(await service.execute({}));
    const sheet = workbook.getWorksheet("Expedientes")!;
    const headers = (sheet.getRow(1).values as unknown[]).filter(Boolean) as string[];
    const row = sheet.getRow(2);
    const dni = row.getCell(headers.indexOf("Documento de Identidad") + 1).value as { text: string; hyperlink: string };
    const cv = row.getCell(headers.indexOf("CV") + 1).value as { text: string; hyperlink: string };

    expect(dni.text).toContain("dni.pdf");
    expect(cv.text).toContain("cv.pdf");
    expect(dni.text).not.toBe(cv.text);
  });
});
