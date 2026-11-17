import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { AsociadosDocumentsZipService } from "../Services/AsociadosDocumentsZipService";
import type { ExportAsociadosService } from "../Services/ExportAsociadosService";

const record = {
  values: {
    "Código Institucional": "IIMP-001",
    "N° Documento": "12345678",
    "Nombres y Apellidos": "Juan Perez Garcia",
  },
  application: {
    updatedAt: new Date("2026-01-03T10:00:00.000Z"),
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
  },
};

describe("AsociadosDocumentsZipService", () => {
  it("genera un ZIP con el padrón y los documentos del asociado", async () => {
    const exportService = {
      getRecords: async () => [record],
      buildBuffer: async () => Buffer.from("excel"),
    } as unknown as ExportAsociadosService;
    const storage = {
      getObjectBuffer: async (fileUrl: string) => Buffer.from(`contenido:${fileUrl}`),
    };

    const service = new AsociadosDocumentsZipService(exportService, storage);
    const result = await service.execute({});

    expect(result.documents).toBe(1);
    expect(result.expedientes).toBe(1);
    expect(result.fileName).toMatch(/^Asociados_Documentos_\d{4}-\d{2}-\d{2}\.zip$/);

    const zip = await JSZip.loadAsync(result.buffer);
    const files = Object.keys(zip.files);
    expect(files.some((file) => file.endsWith("/Asociados.xlsx"))).toBe(true);
    expect(files.some((file) => file.endsWith("/IIMP-001/Documento de Identidad_dni.pdf"))).toBe(true);
    expect(files.some((file) => file.endsWith("/documentos.csv"))).toBe(true);
  });

  it("omite asociados históricos sin documentos", async () => {
    const exportService = {
      getRecords: async () => [
        { values: { "Código Institucional": "SIE-999" }, application: null },
      ],
      buildBuffer: async () => Buffer.from("excel"),
    } as unknown as ExportAsociadosService;

    const service = new AsociadosDocumentsZipService(exportService, {
      getObjectBuffer: async () => Buffer.from("x"),
    });
    const result = await service.execute({});

    expect(result.documents).toBe(0);
    expect(result.expedientes).toBe(0);
  });
});
