import { describe, expect, it } from "vitest";
import { classifyCategoryLoginPolicy, decideProvisioning, isLoginCandidate } from "../Services/MembershipCategoryPolicy";

describe("MembershipCategoryPolicy", () => {
  it("A y E son candidatos a login", () => {
    expect(classifyCategoryLoginPolicy("A")).toBe("READY");
    expect(classifyCategoryLoginPolicy("E")).toBe("READY");
    expect(isLoginCandidate("A")).toBe(true);
    expect(isLoginCandidate("E")).toBe(true);
  });

  it("X/R/U/F no generan login automático", () => {
    for (const code of ["X", "R", "U", "F"]) {
      expect(classifyCategoryLoginPolicy(code)).toBe("NO_LOGIN");
      expect(isLoginCandidate(code)).toBe(false);
    }
  });

  it("V/H/T requieren decisión de negocio", () => {
    for (const code of ["V", "H", "T"]) {
      expect(classifyCategoryLoginPolicy(code)).toBe("BUSINESS_RULE_REQUIRED");
      expect(isLoginCandidate(code)).toBe(false);
    }
  });

  it("categoría desconocida requiere decisión de negocio y no otorga login", () => {
    expect(classifyCategoryLoginPolicy("Z")).toBe("BUSINESS_RULE_REQUIRED");
    expect(isLoginCandidate("Z")).toBe(false);
  });

  it("A LINKED + email + sin mismatch es candidato activo", () => {
    expect(decideProvisioning({ linkStatus: "LINKED", categoryCode: "A", hasEmail: true, categoryMismatch: false })).toBe("CANDIDATE_ACTIVE");
  });

  it("E LINKED + email es candidato estudiante", () => {
    expect(decideProvisioning({ linkStatus: "LINKED", categoryCode: "E", hasEmail: true, categoryMismatch: false })).toBe("CANDIDATE_STUDENT");
  });

  it("CONFLICT bloquea el provisioning", () => {
    expect(decideProvisioning({ linkStatus: "CONFLICT", categoryCode: "A", hasEmail: true, categoryMismatch: false })).toBe("CONFLICT");
  });

  it("CATEGORY_MISMATCH no se resuelve automáticamente", () => {
    expect(decideProvisioning({ linkStatus: "LINKED", categoryCode: "A", hasEmail: true, categoryMismatch: true })).toBe("MANUAL_REVIEW");
  });

  it("UNLINKED no es candidato", () => {
    expect(decideProvisioning({ linkStatus: "UNLINKED", categoryCode: "A", hasEmail: true, categoryMismatch: false })).toBe("MANUAL_REVIEW");
  });

  it("sin email no es candidato", () => {
    expect(decideProvisioning({ linkStatus: "LINKED", categoryCode: "E", hasEmail: false, categoryMismatch: false })).toBe("MANUAL_REVIEW");
  });
});
