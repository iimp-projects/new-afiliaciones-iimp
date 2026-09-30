import { describe, expect, it } from "vitest";
import { ApplicationValidator } from "../Validators/ApplicationValidator";
import { MembershipType } from "../Types/MembershipType";
import type { ApplicationDraft } from "../Models/ApplicationDraft";

function draft(overrides: Partial<ApplicationDraft> = {}): ApplicationDraft {
  return {
    membershipType: MembershipType.STUDENT,
    personalInformation: undefined,
    academicStudies: [],
    employmentInformation: undefined,
    endorsements: undefined,
    ...overrides,
  };
}

describe("ApplicationValidator — Declaración Jurada común (ACTIVE/STUDENT)", () => {
  it("STUDENT sin declaración es rechazado (requiere documento + aceptación)", () => {
    const result = new ApplicationValidator().validate(draft({ membershipType: MembershipType.STUDENT }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.code === "DECLARATION_ACCEPTANCE_REQUIRED")).toBe(true);
    expect(result.errors.some((error) => error.code === "DECLARATION_DOCUMENT_REQUIRED")).toBe(true);
  });

  it("ACTIVE sin declaración es rechazado (además de avales)", () => {
    const result = new ApplicationValidator().validate(draft({ membershipType: MembershipType.ACTIVE }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.code === "ENDORSEMENTS_REQUIRED")).toBe(true);
    expect(result.errors.some((error) => error.code === "DECLARATION_ACCEPTANCE_REQUIRED")).toBe(true);
    expect(result.errors.some((error) => error.code === "DECLARATION_DOCUMENT_REQUIRED")).toBe(true);
  });

  it("STUDENT con declaración completa ya no reporta errores de declaración", () => {
    const result = new ApplicationValidator().validate(
      draft({
        membershipType: MembershipType.STUDENT,
        endorsements: { declarationAccepted: true, declarationDocumentId: "afiliaciones/applications/1/declarations/signed.pdf" },
      }),
    );
    const declarationErrors = result.errors.filter((error) =>
      error.code === "DECLARATION_ACCEPTANCE_REQUIRED" || error.code === "DECLARATION_DOCUMENT_REQUIRED",
    );
    expect(declarationErrors).toHaveLength(0);
  });
});
