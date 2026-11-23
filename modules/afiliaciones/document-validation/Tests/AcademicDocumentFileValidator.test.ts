import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import {
  AcademicDocumentFileError,
  validateAcademicDocumentFile,
} from "../Validators/AcademicDocumentFileValidator";

const policy = {
  maxBytes: 10 * 1024 * 1024,
  maxPages: 5,
  maxImageDimension: 6000,
};

async function pdfWithPages(pages: number): Promise<Buffer> {
  const document = await PDFDocument.create();
  for (let index = 0; index < pages; index += 1) document.addPage();
  return Buffer.from(await document.save());
}

function pngWithDimensions(width: number, height: number): Buffer {
  const buffer = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer, 0);
  buffer.writeUInt32BE(13, 8);
  buffer.write("IHDR", 12, "ascii");
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

describe("AcademicDocumentFileValidator", () => {
  it("TEST-15: acepta un PDF de varias páginas dentro del límite", async () => {
    const result = await validateAcademicDocumentFile(await pdfWithPages(3), "application/pdf", policy);
    expect(result).toEqual({ kind: "pdf", pages: 3, width: null, height: null });
  });

  it("rechaza un PDF que supera el máximo de páginas", async () => {
    await expect(
      validateAcademicDocumentFile(await pdfWithPages(6), "application/pdf", policy),
    ).rejects.toMatchObject({ code: "TOO_MANY_PAGES" });
  });

  it("TEST-16: rechaza un PDF malformado", async () => {
    const malformed = Buffer.from("%PDF-1.7 esto no es un pdf válido");
    await expect(
      validateAcademicDocumentFile(malformed, "application/pdf", policy),
    ).rejects.toBeInstanceOf(AcademicDocumentFileError);
    await expect(
      validateAcademicDocumentFile(malformed, "application/pdf", policy),
    ).rejects.toMatchObject({ code: "MALFORMED" });
  });

  it("rechaza un archivo vacío o sobredimensionado", async () => {
    await expect(
      validateAcademicDocumentFile(Buffer.alloc(0), "image/png", policy),
    ).rejects.toMatchObject({ code: "EMPTY" });
    await expect(
      validateAcademicDocumentFile(pngWithDimensions(800, 600), "image/png", { ...policy, maxBytes: 10 }),
    ).rejects.toMatchObject({ code: "TOO_LARGE" });
  });

  it("valida la firma real y no solo el MIME declarado", async () => {
    await expect(
      validateAcademicDocumentFile(pngWithDimensions(800, 600), "application/pdf", policy),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_TYPE" });
  });

  it("acepta una imagen PNG legible y rechaza una demasiado pequeña", async () => {
    await expect(
      validateAcademicDocumentFile(pngWithDimensions(800, 600), "image/png", policy),
    ).resolves.toMatchObject({ kind: "image", width: 800, height: 600 });
    await expect(
      validateAcademicDocumentFile(pngWithDimensions(100, 100), "image/png", policy),
    ).rejects.toMatchObject({ code: "RESOLUTION" });
  });

  it("rechaza una imagen que supera la resolución máxima", async () => {
    await expect(
      validateAcademicDocumentFile(pngWithDimensions(9000, 9000), "image/png", policy),
    ).rejects.toMatchObject({ code: "RESOLUTION" });
  });
});
