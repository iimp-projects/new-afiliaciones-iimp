import { describe, expect, it } from "vitest";
import {
  associateDocumentCategory,
  requiredAssociateDocumentSlots,
  resolveAssociateDocumentSlot,
} from "../Utilities/associateDocumentSlots";

describe("associateDocumentSlots", () => {
  it("exige identidad y foto a todos, y constancia al estudiante", () => {
    expect(requiredAssociateDocumentSlots(false)).toEqual(["ID_DOCUMENT", "PHOTO"]);
    expect(requiredAssociateDocumentSlots(true)).toEqual(["ID_DOCUMENT", "PHOTO", "STUDY_CERTIFICATE"]);
  });

  it("resuelve foto y constancia desde documentos OTHER", () => {
    expect(resolveAssociateDocumentSlot({ category: "OTHER", mimeType: "image/jpeg", fileName: "foto.jpg" })).toBe("PHOTO");
    expect(resolveAssociateDocumentSlot({ category: "OTHER", mimeType: "application/pdf", fileName: "Constancia_Estudios.pdf" })).toBe("STUDY_CERTIFICATE");
    expect(resolveAssociateDocumentSlot({ category: "OTHER", mimeType: "application/pdf", fileName: "otro.pdf" })).toBe("OTHER");
    expect(resolveAssociateDocumentSlot({ category: "CV" })).toBe("CV");
  });

  it("mapea cada slot a su categoría y prefijo de archivo", () => {
    expect(associateDocumentCategory("ID_DOCUMENT")).toEqual({ category: "ID_DOCUMENT" });
    expect(associateDocumentCategory("PHOTO")).toEqual({ category: "OTHER", fileNamePrefix: "Fotografia" });
    expect(associateDocumentCategory("STUDY_CERTIFICATE")).toEqual({ category: "OTHER", fileNamePrefix: "Constancia" });
    expect(associateDocumentCategory("DEGREE_CERTIFICATE")).toEqual({ category: "DEGREE_CERTIFICATE" });
  });
});
