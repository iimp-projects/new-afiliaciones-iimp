import { describe, expect, it } from "vitest";
import {
  MAX_STUDENT_LETTER_BYTES,
  validateDocumentUpload,
  validateStudentLetterFile,
} from "./StudentLetterFileValidator";

const file = (overrides: Partial<{ name: string; size: number; type: string }> = {}) => ({
  name: "constancia.pdf",
  size: 1024,
  type: "application/pdf",
  ...overrides,
});

describe("validateStudentLetterFile", () => {
  it("acepta PDF, JPG, JPEG y PNG válidos", () => {
    expect(validateStudentLetterFile(file())).toBeNull();
    expect(validateStudentLetterFile(file({ name: "constancia.jpg", type: "image/jpeg" }))).toBeNull();
    expect(validateStudentLetterFile(file({ name: "constancia.jpeg", type: "image/jpeg" }))).toBeNull();
    expect(validateStudentLetterFile(file({ name: "constancia.png", type: "image/png" }))).toBeNull();
    expect(validateStudentLetterFile(file({ name: "CONSTANCIA.PDF", type: "application/pdf" }))).toBeNull();
  });

  it("rechaza archivos vacíos", () => {
    expect(validateStudentLetterFile(file({ size: 0 }))).toContain("vacío");
  });

  it("rechaza archivos que superan los 10 MB", () => {
    expect(validateStudentLetterFile(file({ size: MAX_STUDENT_LETTER_BYTES + 1 }))).toContain(
      "10 MB",
    );
  });

  it("rechaza extensiones no permitidas", () => {
    expect(validateStudentLetterFile(file({ name: "constancia.docx", type: "application/msword" }))).toContain(
      "Formato no permitido",
    );
  });

  it("rechaza cuando el contenido no coincide con la extensión", () => {
    expect(validateStudentLetterFile(file({ name: "constancia.pdf", type: "image/png" }))).toContain(
      "no coincide",
    );
  });

  it("valida el documento de identidad en PDF o imagen", () => {
    expect(validateDocumentUpload(file(), "identity")).toBeNull();
    expect(
      validateDocumentUpload(
        file({ name: "dni.jpg", type: "image/jpeg" }),
        "identity",
      ),
    ).toBeNull();
    expect(
      validateDocumentUpload(
        file({ name: "dni.docx", type: "application/msword" }),
        "identity",
      ),
    ).toContain("Formato no permitido");
  });

  it("valida la fotografía en PDF o imagen", () => {
    expect(
      validateDocumentUpload(
        file({ name: "foto.png", type: "image/png" }),
        "photo",
      ),
    ).toBeNull();
    expect(
      validateDocumentUpload(
        file({ name: "foto.webp", type: "image/webp" }),
        "photo",
      ),
    ).toBeNull();
    expect(validateDocumentUpload(file({ name: "foto.pdf" }), "photo")).toBeNull();
    expect(
      validateDocumentUpload(
        file({ name: "foto.docx", type: "application/msword" }),
        "photo",
      ),
    ).toContain("Formato no permitido");
  });

  it("valida la declaración firmada en PDF o imagen y hasta 3 MB", () => {
    expect(validateDocumentUpload(file(), "declaration")).toBeNull();
    expect(
      validateDocumentUpload(
        file({ name: "declaracion.jpg", type: "image/jpeg" }),
        "declaration",
      ),
    ).toBeNull();
    expect(
      validateDocumentUpload(
        file({ name: "declaracion.docx", type: "application/msword" }),
        "declaration",
      ),
    ).toContain("Formato no permitido");
    expect(
      validateDocumentUpload(
        file({ size: 3 * 1024 * 1024 + 1 }),
        "declaration",
      ),
    ).toContain("3 MB");
  });
});
