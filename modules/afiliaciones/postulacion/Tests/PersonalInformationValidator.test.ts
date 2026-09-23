import { describe, expect, it } from "vitest";
import { PersonalInformationValidator } from "../Validators/PersonalInformationValidator";
import type { PersonalInformation } from "../Models/PersonalInformation";

const base = {
  documentType: "DNI",
  documentNumber: "12345678",
  names: "Juan",
  fatherLastName: "Perez",
  motherLastName: "Gomez",
  birthDate: "1990-01-01",
  gender: "MALE",
  phone: "999999999",
  primaryEmail: "juan@example.com",
  countryId: 1,
  departmentId: 10,
  provinceId: 20,
  districtId: 321,
  address: "Av. Test 123",
  photo: { name: "foto.jpg" },
  identityDocument: { name: "doc.pdf" },
  identityVerified: false,
} as unknown as PersonalInformation;

function validate(personal: PersonalInformation) {
  return new PersonalInformationValidator().validate(personal);
}

const hasError = (result: ReturnType<typeof validate>, field: string) =>
  result.errors.some((error) => error.field === field);

describe("PersonalInformationValidator — ubicación geográfica", () => {
  it("acepta Perú con departamento, provincia y distrito", () => {
    const result = validate(base);
    expect(result.valid).toBe(true);
    expect(hasError(result, "provinceId")).toBe(false);
    expect(hasError(result, "districtId")).toBe(false);
  });

  it("acepta Perú con departamento y provincia, sin distrito", () => {
    const result = validate({ ...base, districtId: undefined });
    expect(hasError(result, "districtId")).toBe(false);
    expect(hasError(result, "provinceId")).toBe(false);
  });

  it("acepta Perú con departamento, sin provincia ni distrito", () => {
    const result = validate({ ...base, provinceId: undefined, districtId: undefined });
    expect(hasError(result, "provinceId")).toBe(false);
    expect(hasError(result, "districtId")).toBe(false);
  });

  it("rechaza Perú sin departamento", () => {
    const result = validate({ ...base, departmentId: undefined });
    expect(hasError(result, "departmentId")).toBe(true);
  });

  it("rechaza Perú sin país", () => {
    const result = validate({ ...base, countryId: 0 });
    expect(hasError(result, "countryId")).toBe(true);
  });

  it("rechaza Perú sin dirección completa", () => {
    const result = validate({ ...base, address: "   " });
    expect(hasError(result, "address")).toBe(true);
  });

  it("no genera error de provincia cuando no hay provincias disponibles", () => {
    const result = validate({ ...base, provinceId: undefined });
    expect(hasError(result, "provinceId")).toBe(false);
  });

  it("no genera error de distrito cuando no hay distritos disponibles", () => {
    const result = validate({ ...base, districtId: undefined });
    expect(hasError(result, "districtId")).toBe(false);
  });
});
