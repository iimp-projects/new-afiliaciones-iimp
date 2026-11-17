import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { ExpedienteDocumentsZipService } from "../Services/ExpedienteDocumentsZipService";
import type { ExportExpedientesService } from "../Services/ExportExpedientesService";

const record = {
  id: 1,
  trackingCode: "APP-001",
  applicationCode: "COD-001",
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
    {
      category: "CV",
      fileUrl: "afiliaciones/applications/1/documents/cv.pdf",
      fileName: "cv.pdf",
      mimeType: "application/pdf",
      createdAt: new Date("2026-01-01T10:00:00.000Z"),
      updatedAt: new Date("2026-01-02T10:00:00.000Z"),
    },
  ],
};

describe("ExpedienteDocumentsZipService", () => {
  it("genera un ZIP por expediente con los documentos vigentes y manifiesto", async () => {
    const exportService = {
      getRecords: async () => [record],
      buildBuffer: async () => Buffer.from("excel"),
    } as unknown as ExportExpedientesService;
    const storage = {
      getObjectBuffer: async (fileUrl: string) => Buffer.from(`contenido:${fileUrl}`),
    };

    const service = new ExpedienteDocumentsZipService(exportService, storage);
    const result = await service.execute({});

    expect(result.documents).toBe(2);
    expect(result.expedientes).toBe(1);
    expect(result.fileName).toMatch(/^Expedientes_Documentos_\d{4}-\d{2}-\d{2}\.zip$/);

    const zip = await JSZip.loadAsync(result.buffer);
    const files = Object.keys(zip.files);
    expect(files.some((file) => file.endsWith("/APP-001/Documento de Identidad_dni.pdf"))).toBe(true);
    expect(files.some((file) => file.endsWith("/APP-001/CV_cv.pdf"))).toBe(true);
    expect(files.some((file) => file.endsWith("/documentos.csv"))).toBe(true);
    expect(files.some((file) => file.endsWith("/Expedientes.xlsx"))).toBe(true);

    const manifest = await zip.file(files.find((file) => file.endsWith("/documentos.csv"))!)!.async("string");
    expect(manifest).toContain("APP-001");
    expect(manifest).toContain("dni.pdf");
  });

  it("incluye errores de descarga sin abortar el ZIP", async () => {
    const exportService = {
      getRecords: async () => [record],
      buildBuffer: async () => Buffer.from("excel"),
    } as unknown as ExportExpedientesService;
    const storage = {
      getObjectBuffer: async () => {
        throw new Error("S3 down");
      },
    };

    const service = new ExpedienteDocumentsZipService(exportService, storage);
    const result = await service.execute({});

    expect(result.documents).toBe(0);
    expect(result.errors.length).toBe(2);
    const zip = await JSZip.loadAsync(result.buffer);
    expect(Object.keys(zip.files).some((file) => file.endsWith("/_errores.txt"))).toBe(true);
  });
});
