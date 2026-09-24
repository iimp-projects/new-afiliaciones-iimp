import { beforeEach, describe, expect, it, vi } from "vitest";
import { isObjectKeyAllowed, S3StorageService } from "./S3StorageService";

const send = vi.hoisted(() => vi.fn());

vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class { send = send; },
  PutObjectCommand: class {},
  GetObjectCommand: class {},
}));

describe("S3StorageService.getObjectKey", () => {
  beforeEach(() => {
    process.env.AWS_BUCKET = "test-bucket";
    process.env.AWS_DEFAULT_REGION = "us-east-1";
  });

  it("acepta una clave válida y una URL del bucket autorizado", () => {
    const service = new S3StorageService();
    expect(service.getObjectKey("afiliaciones/applications/5/photos/a.jpg")).toBe("afiliaciones/applications/5/photos/a.jpg");
    expect(service.getObjectKey("https://test-bucket.s3.us-east-1.amazonaws.com/afiliaciones/applications/5/photos/a.jpg"))
      .toBe("afiliaciones/applications/5/photos/a.jpg");
  });

  it("rechaza un host que no pertenece al bucket", () => {
    const service = new S3StorageService();
    expect(() => service.getObjectKey("https://evil.example.com/afiliaciones/applications/5/photos/a.jpg"))
      .toThrow(/no pertenece/);
  });

  it("rechaza path traversal y segmentos inválidos", () => {
    const service = new S3StorageService();
    expect(() => service.getObjectKey("afiliaciones/applications/5/../../secret")).toThrow(/no es válida/);
    expect(() => service.getObjectKey("afiliaciones//applications/5")).toThrow(/no es válida/);
    expect(() => service.getObjectKey("/afiliaciones/applications/5")).toThrow(/no es válida/);
    expect(() => service.getObjectKey("afiliaciones\\applications\\5")).toThrow(/no es válida/);
  });
});

describe("isObjectKeyAllowed", () => {
  it("permite claves dentro de un prefijo autorizado", () => {
    expect(isObjectKeyAllowed("afiliaciones/applications/5/photos/a.jpg", ["afiliaciones/applications/5"])).toBe(true);
    expect(isObjectKeyAllowed("afiliaciones/applications/5/photos/a.jpg", ["afiliaciones/applications"])).toBe(true);
  });

  it("no confunde prefijos numéricos distintos", () => {
    expect(isObjectKeyAllowed("afiliaciones/applications/50/photos/a.jpg", ["afiliaciones/applications/5"])).toBe(false);
  });

  it("rechaza un prefijo no autorizado", () => {
    expect(isObjectKeyAllowed("afiliaciones/perfiles/a.jpg", ["afiliaciones/applications"])).toBe(false);
    expect(isObjectKeyAllowed("legacy_docs/a.pdf", ["afiliaciones/applications"])).toBe(false);
  });

  it("permite una clave explícitamente autorizada", () => {
    expect(isObjectKeyAllowed("legacy_docs/a.pdf", [], ["legacy_docs/a.pdf"])).toBe(true);
  });
});

describe("S3StorageService.getObjectBuffer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AWS_BUCKET = "test-bucket";
    process.env.AWS_DEFAULT_REGION = "us-east-1";
  });

  it("descarga el objeto y devuelve un Buffer (stream web)", async () => {
    send.mockResolvedValueOnce({
      Body: { transformToByteArray: async () => new Uint8Array(Buffer.from("SIGNED_PDF")) },
    });

    const buffer = await new S3StorageService().getObjectBuffer(
      "afiliaciones/applications/5/declarations/signed.pdf",
      ["afiliaciones/applications/5"],
    );

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.toString()).toBe("SIGNED_PDF");
  });

  it("descarga el objeto y devuelve un Buffer (stream iterable Node)", async () => {
    send.mockResolvedValueOnce({
      Body: (async function* () {
        yield Buffer.from("SIGN");
        yield Buffer.from("ED");
      })(),
    });

    const buffer = await new S3StorageService().getObjectBuffer(
      "afiliaciones/applications/5/declarations/signed.pdf",
      ["afiliaciones/applications/5"],
    );

    expect(buffer.toString()).toBe("SIGNED");
  });

  it("rechaza una clave fuera del prefijo autorizado (otra aplicación)", async () => {
    await expect(
      new S3StorageService().getObjectBuffer(
        "afiliaciones/applications/99/declarations/x.pdf",
        ["afiliaciones/applications/5"],
      ),
    ).rejects.toThrow(/No tiene acceso/);
    expect(send).not.toHaveBeenCalled();
  });

  it("rechaza una URL de otro host/bucket", async () => {
    await expect(
      new S3StorageService().getObjectBuffer(
        "https://evil.example.com/afiliaciones/applications/5/x.pdf",
        ["afiliaciones/applications/5"],
      ),
    ).rejects.toThrow(/no pertenece/);
    expect(send).not.toHaveBeenCalled();
  });
});
