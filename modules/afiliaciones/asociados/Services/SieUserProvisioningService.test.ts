import { describe, expect, it } from "vitest";
import {
  classifyProvisioning,
  isValidProvisioningEmail,
  normalizeProvisioningEmail,
} from "./SieUserProvisioningService";

const ctx = (overrides: Partial<Parameters<typeof classifyProvisioning>[0]> = {}) => ({
  hasUser: false,
  isActiveOrStudent: true,
  email: "asociado@example.com",
  emailOwnedByOtherAccount: false,
  emailSharedAcrossPersons: false,
  ...overrides,
});

describe("classifyProvisioning", () => {
  it("clasifica como ELIGIBLE a un asociado A/E sin usuario y con correo único válido", () => {
    expect(classifyProvisioning(ctx())).toBe("ELIGIBLE");
  });

  it("excluye personas que ya tienen usuario", () => {
    expect(classifyProvisioning(ctx({ hasUser: true }))).toBe("EXCLUDED_HAS_USER");
  });

  it("excluye categorías no A/E", () => {
    expect(classifyProvisioning(ctx({ isActiveOrStudent: false }))).toBe("EXCLUDED_NON_AE");
  });

  it("excluye personas sin correo", () => {
    expect(classifyProvisioning(ctx({ email: null }))).toBe("EXCLUDED_NO_EMAIL");
  });

  it("excluye correos inválidos (a@, a@a)", () => {
    expect(classifyProvisioning(ctx({ email: "a@" }))).toBe("EXCLUDED_INVALID_EMAIL");
    expect(classifyProvisioning(ctx({ email: "a@a" }))).toBe("EXCLUDED_INVALID_EMAIL");
  });

  it("excluye correos que pertenecen a otra cuenta", () => {
    expect(classifyProvisioning(ctx({ emailOwnedByOtherAccount: true }))).toBe("EXCLUDED_EMAIL_CONFLICT");
  });

  it("excluye correos compartidos entre varias personas", () => {
    expect(classifyProvisioning(ctx({ emailSharedAcrossPersons: true }))).toBe("EXCLUDED_DUPLICATE_EMAIL");
  });

  it("prioriza HAS_USER antes que el resto de exclusiones", () => {
    expect(classifyProvisioning(ctx({ hasUser: true, email: null, isActiveOrStudent: false }))).toBe("EXCLUDED_HAS_USER");
  });
});

describe("validación de correo", () => {
  it("valida correos bien formados y normaliza a minúsculas", () => {
    expect(isValidProvisioningEmail("Asociado@IIMP.org.pe")).toBe(true);
    expect(normalizeProvisioningEmail("  Asociado@IIMP.org.pe ")).toBe("asociado@iimp.org.pe");
  });

  it("rechaza correos malformados", () => {
    expect(isValidProvisioningEmail("a@")).toBe(false);
    expect(isValidProvisioningEmail("a@a")).toBe(false);
    expect(isValidProvisioningEmail("")).toBe(false);
    expect(isValidProvisioningEmail(null)).toBe(false);
  });
});
