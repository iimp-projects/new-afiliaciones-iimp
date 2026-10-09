import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPresignedApplicationDocumentUrl: vi.fn(),
}));

vi.mock("@/modules/shared/Services/S3StorageService", () => ({
  S3StorageService: class {
    getPresignedApplicationDocumentUrl = mocks.getPresignedApplicationDocumentUrl;
  },
}));

import { resolveAffiliatePhoto } from "./AffiliatePhotoResolver";

describe("resolveAffiliatePhoto", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPresignedApplicationDocumentUrl.mockResolvedValue("https://presigned.example/photo");
  });

  const photoDoc = {
    mimeType: "image/jpeg",
    category: "OTHER",
    fileName: "foto-perfil.jpg",
    fileUrl: "afiliaciones/applications/7/foto.jpg",
  };

  it("devuelve la URL firmada de un documento de foto (category OTHER)", async () => {
    const result = await resolveAffiliatePhoto([{ documents: [photoDoc] }]);

    expect(result).toBe("https://presigned.example/photo");
    expect(mocks.getPresignedApplicationDocumentUrl).toHaveBeenCalledWith(photoDoc.fileUrl, [
      "afiliaciones/applications",
      "afiliaciones/legacy/documents",
    ]);
  });

  it("detecta la foto por nombre de archivo aunque la categoría no sea OTHER", async () => {
    const doc = { ...photoDoc, category: "ID_DOCUMENT", fileName: "mi-foto.jpg" };

    const result = await resolveAffiliatePhoto([{ documents: [doc] }]);

    expect(result).toBe("https://presigned.example/photo");
  });

  it("ignora imágenes que no son fotos (sin category OTHER ni 'foto' en el nombre)", async () => {
    const doc = { ...photoDoc, category: "ID_DOCUMENT", fileName: "dni.jpg" };

    const result = await resolveAffiliatePhoto([{ documents: [doc] }]);

    expect(result).toBeNull();
  });

  it("devuelve null cuando no hay documentos", async () => {
    const result = await resolveAffiliatePhoto([{ documents: [] }]);

    expect(result).toBeNull();
  });

  it("devuelve null cuando la firma falla", async () => {
    mocks.getPresignedApplicationDocumentUrl.mockRejectedValue(new Error("boom"));

    const result = await resolveAffiliatePhoto([{ documents: [photoDoc] }]);

    expect(result).toBeNull();
  });
});
