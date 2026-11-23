import { describe, expect, it } from "vitest";
import { deepMergeDraft } from "../utils/deepMerge";

function draftWithDocuments() {
  return {
    personalInformation: {
      names: "Roiser",
      documentNumber: "77380653",
      identityDocument: { url: "https://s3/legacy/dni.pdf", name: "dni.pdf", type: "application/pdf" },
      photo: { url: "https://s3/legacy/foto.jpg", name: "foto.jpg", type: "image/jpeg" },
    },
    endorsements: {
      declarationDocumentId: "https://s3/declaracion.pdf",
      firstEndorsement: null,
    },
    academicStudies: [{ universityLetter: { url: "https://s3/carta.pdf", name: "carta.pdf", type: "application/pdf" } }],
  };
}

describe("deepMergeDraft — fusión segura de borradores", () => {
  it("TEST-08: un campo omitido no se convierte en null", () => {
    const current = draftWithDocuments();
    const proposed = {
      personalInformation: { names: "Roiser" },
      endorsements: { declarationDocumentId: "https://s3/declaracion.pdf" },
      academicStudies: [{ universityLetter: { url: "https://s3/carta2.pdf", name: "carta2.pdf", type: "application/pdf" } }],
    };
    const merged = deepMergeDraft(current, proposed) as any;
    expect(merged.personalInformation.identityDocument).toEqual(current.personalInformation.identityDocument);
    expect(merged.personalInformation.photo).toEqual(current.personalInformation.photo);
    expect(merged.personalInformation.documentNumber).toBe("77380653");
  });

  it("un campo enviado como null conserva el valor anterior", () => {
    const current = draftWithDocuments();
    const proposed = {
      personalInformation: { identityDocument: null, photo: null },
    };
    const merged = deepMergeDraft(current, proposed) as any;
    expect(merged.personalInformation.identityDocument).toEqual(current.personalInformation.identityDocument);
    expect(merged.personalInformation.photo).toEqual(current.personalInformation.photo);
  });

  it("TEST-03: subsanar un documento conserva los campos personales", () => {
    const current = draftWithDocuments();
    const proposed = {
      academicStudies: [{ universityLetter: { url: "https://s3/carta-nueva.pdf", name: "carta-nueva.pdf", type: "application/pdf" } }],
    };
    const merged = deepMergeDraft(current, proposed) as any;
    expect(merged.personalInformation).toEqual(current.personalInformation);
    expect(merged.endorsements).toEqual(current.endorsements);
    expect(merged.academicStudies[0].universityLetter.url).toBe("https://s3/carta-nueva.pdf");
  });

  it("un valor válido enviado actualiza el campo", () => {
    const merged = deepMergeDraft({ a: 1 }, { a: 2 }) as any;
    expect(merged.a).toBe(2);
  });

  it("un array modificado reemplaza al anterior sin borrado accidental de primitivos", () => {
    const merged = deepMergeDraft({ list: [1, 2, 3] }, { list: [4] }) as any;
    expect(merged.list).toEqual([4]);
  });

  it("un array omitido (undefined) conserva el array anterior completo", () => {
    const current = { academicStudies: [{ id: 1 }, { id: 2 }] };
    const proposed = { personalInformation: { names: "A" } };
    const merged = deepMergeDraft(current, proposed) as any;
    expect(merged.academicStudies).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it("un array enviado como null conserva el array anterior (no se convierte en vacío)", () => {
    const current = { academicStudies: [{ id: 1 }] };
    const proposed = { academicStudies: null };
    const merged = deepMergeDraft(current, proposed) as any;
    expect(merged.academicStudies).toEqual([{ id: 1 }]);
  });

  it("un array enviado con la colección completa reemplaza la anterior", () => {
    const current = { academicStudies: [{ specialtyId: 1 }] };
    const proposed = { academicStudies: [{ specialtyId: 2, universityLetter: { url: "u" } }] };
    const merged = deepMergeDraft(current, proposed) as any;
    expect(merged.academicStudies).toEqual([{ specialtyId: 2, universityLetter: { url: "u" } }]);
  });

  it("conserva claves no presentes en proposed (merge profundo por clave)", () => {
    const current = { personalInformation: { names: "A", gender: "MALE" } };
    const proposed = { personalInformation: { names: "B" } };
    const merged = deepMergeDraft(current, proposed) as any;
    expect(merged.personalInformation.gender).toBe("MALE");
    expect(merged.personalInformation.names).toBe("B");
  });

  it("null en la raíz conserva el objeto anterior completo", () => {
    const current = { personalInformation: { names: "A" } };
    const merged = deepMergeDraft(current, null as any) as any;
    expect(merged).toEqual(current);
  });
});
