import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getObjectKey: vi.fn((url: string) => url),
  getObjectBuffer: vi.fn(),
}));

vi.mock("@/modules/shared/Services/S3StorageService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/shared/Services/S3StorageService")>();
  return {
    ...actual,
    S3StorageService: class {
      getObjectKey = mocks.getObjectKey;
      getObjectBuffer = mocks.getObjectBuffer;
    },
  };
});

import { StatusChangeAttachmentService, StatusChangeAttachmentError } from "./StatusChangeAttachmentService";

const ref = (overrides: Record<string, unknown> = {}) => ({
  applicationId: 26,
  attachmentUrl: "afiliaciones/applications/26/observations/evidencia.pdf",
  attachmentName: "evidencia.pdf",
  mimeType: "application/pdf",
  ...overrides,
});

describe("StatusChangeAttachmentService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("devuelve [] cuando no hay attachmentUrl", async () => {
    const result = await new StatusChangeAttachmentService().resolve({ applicationId: 26, attachmentUrl: null });
    expect(result).toEqual([]);
    expect(mocks.getObjectBuffer).not.toHaveBeenCalled();
  });

  it("resuelve un adjunto válido conservando nombre y MIME originales", async () => {
    mocks.getObjectBuffer.mockResolvedValue(Buffer.from("%PDF-CONTENT"));
    const result = await new StatusChangeAttachmentService().resolve(ref());

    expect(result).toHaveLength(1);
    expect(result[0].filename).toBe("evidencia.pdf");
    expect(result[0].contentType).toBe("application/pdf");
    expect(result[0].content.toString()).toBe("%PDF-CONTENT");
    expect(mocks.getObjectBuffer).toHaveBeenCalledWith(
      "afiliaciones/applications/26/observations/evidencia.pdf",
      ["afiliaciones/applications/26"],
    );
  });

  it("rechaza un archivo de otro expediente sin descargarlo", async () => {
    await expect(
      new StatusChangeAttachmentService().resolve(
        ref({ attachmentUrl: "afiliaciones/applications/99/observations/x.pdf" }),
      ),
    ).rejects.toBeInstanceOf(StatusChangeAttachmentError);
    expect(mocks.getObjectBuffer).not.toHaveBeenCalled();
  });

  it("deriva nombre y MIME desde la clave cuando no hay metadatos", async () => {
    mocks.getObjectBuffer.mockResolvedValue(Buffer.from("RIFF....WEBP"));
    const result = await new StatusChangeAttachmentService().resolve(
      ref({ attachmentName: null, mimeType: null, attachmentUrl: "afiliaciones/applications/26/observations/uuid.webp" }),
    );
    expect(result[0].filename).toBe("uuid.webp");
    expect(result[0].contentType).toBe("image/webp");
  });

  it("neutraliza separadores de ruta en el nombre original", async () => {
    mocks.getObjectBuffer.mockResolvedValue(Buffer.from("X"));
    const result = await new StatusChangeAttachmentService().resolve(
      ref({ attachmentName: "../malicioso.pdf" }),
    );
    expect(result[0].filename).toBe(".._malicioso.pdf");
  });

  it("rechaza un buffer vacío", async () => {
    mocks.getObjectBuffer.mockResolvedValue(Buffer.from(""));
    await expect(new StatusChangeAttachmentService().resolve(ref())).rejects.toThrow(/vacío/);
  });

  it("rechaza un archivo que excede el límite de tamaño", async () => {
    mocks.getObjectBuffer.mockResolvedValue(Buffer.alloc(11));
    await expect(new StatusChangeAttachmentService(undefined, 10).resolve(ref())).rejects.toThrow(/excede/);
  });
});
