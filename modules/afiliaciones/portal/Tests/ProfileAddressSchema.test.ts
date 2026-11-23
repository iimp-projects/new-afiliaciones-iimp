import { describe, expect, it } from "vitest";
import { profileAddressSchema } from "../Validators/ProfileAddressSchema";

const peru = {
  street: "Av. Prueba 123",
  reference: null,
  countryId: 1,
  districtId: 321,
  postalCode: "15024",
  foreignRegion: null,
  foreignCity: null,
};

describe("profileAddressSchema", () => {
  it("acepta una dirección peruana completa", () => {
    expect(profileAddressSchema.safeParse(peru).success).toBe(true);
  });

  it("acepta código postal opcional en Perú", () => {
    expect(profileAddressSchema.safeParse({ ...peru, postalCode: null }).success).toBe(true);
    expect(profileAddressSchema.safeParse({ ...peru, postalCode: "" }).success).toBe(true);
  });

  it("exige distrito en Perú", () => {
    const result = profileAddressSchema.safeParse({ ...peru, districtId: null });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.some((issue) => issue.path.includes("districtId"))).toBe(true);
  });

  it("acepta extranjero sin código postal y exige región y ciudad", () => {
    const foreign = { ...peru, countryId: 2, districtId: null, postalCode: null, foreignRegion: "Kabul", foreignCity: "Kabul" };
    expect(profileAddressSchema.safeParse(foreign).success).toBe(true);

    const result = profileAddressSchema.safeParse({ ...foreign, foreignRegion: null, foreignCity: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path.join("."));
      expect(paths).toContain("foreignRegion");
      expect(paths).toContain("foreignCity");
    }
  });

  it("rechaza un país inválido", () => {
    expect(profileAddressSchema.safeParse({ ...peru, countryId: 0 }).success).toBe(false);
  });

  it("permite reutilizar el esquema con campos adicionales del admin", () => {
    expect(profileAddressSchema.safeParse({ ...peru, phone: "999999999", secondaryEmail: null }).success).toBe(true);
  });
});
