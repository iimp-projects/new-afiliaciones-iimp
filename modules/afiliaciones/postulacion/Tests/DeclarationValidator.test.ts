import { describe, expect, it } from "vitest";
import { DeclarationValidator } from "../Validators/DeclarationValidator";
import type { Declaration } from "../Models/Declaration";

describe("DeclarationValidator", () => {
  it("acepta una declaración completa (aceptación + documento)", () => {
    const validator = new DeclarationValidator();
    const result = validator.validate({ declarationAccepted: true, declarationDocumentId: "afiliaciones/applications/1/declarations/signed.pdf" });
    expect(result.valid).toBe(true);
  });

  it("rechaza sin declarationAccepted", () => {
    const result = new DeclarationValidator().validate({ declarationAccepted: false, declarationDocumentId: "url.pdf" });
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.code === "DECLARATION_ACCEPTANCE_REQUIRED")).toBe(true);
  });

  it("rechaza sin declarationDocumentId", () => {
    const result = new DeclarationValidator().validate({ declarationAccepted: true } as Declaration);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.code === "DECLARATION_DOCUMENT_REQUIRED")).toBe(true);
  });

  it("rechaza cuando no existe declaración", () => {
    const result = new DeclarationValidator().validate(undefined);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.code === "DECLARATION_ACCEPTANCE_REQUIRED")).toBe(true);
    expect(result.errors.some((error) => error.code === "DECLARATION_DOCUMENT_REQUIRED")).toBe(true);
  });
});
