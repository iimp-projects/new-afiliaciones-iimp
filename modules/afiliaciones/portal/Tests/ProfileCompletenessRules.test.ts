import { describe, expect, it } from "vitest";
import { findMissingProfileData, type ProfileCompletenessSource } from "../Rules/ProfileCompletenessRules";

const completePeru: ProfileCompletenessSource = {
  firstName: "Ana",
  paternalLastName: "Pérez",
  documentType: "DNI",
  documentNumber: "12345678",
  birthDate: "1990-01-01",
  email: "ana@example.com",
  phone: "999999999",
  address: {
    countryId: 1,
    street: "Av. Prueba 123",
    districtId: 321,
    postalCode: "15024",
  },
};

const fields = (source: ProfileCompletenessSource) =>
  findMissingProfileData(source).map((item) => item.field);

describe("ProfileCompletenessRules", () => {
  it("acepta un perfil peruano completo", () => {
    expect(findMissingProfileData(completePeru)).toEqual([]);
  });

  it("exige distrito en Perú y deja el código postal como opcional", () => {
    const result = findMissingProfileData({
      ...completePeru,
      address: { ...completePeru.address!, districtId: null, postalCode: null },
    });

    expect(result).toEqual([
      { field: "districtId", label: "distrito", section: "address" },
    ]);
  });

  it("en el extranjero exige región y ciudad, y no código postal", () => {
    expect(fields({
      ...completePeru,
      address: {
        countryId: 2,
        street: "Kabul Road 1",
        districtId: null,
        postalCode: null,
        foreignRegion: "Kabul",
        foreignCity: "Kabul",
      },
    })).toEqual([]);

    expect(fields({
      ...completePeru,
      address: {
        countryId: 2,
        street: "Kabul Road 1",
        districtId: null,
        postalCode: null,
        foreignRegion: "",
        foreignCity: "",
      },
    })).toEqual(["foreignRegion", "foreignCity"]);
  });

  it("reporta identidad y contacto faltantes", () => {
    expect(fields({
      ...completePeru,
      birthDate: null,
      email: " ",
      phone: null,
    })).toEqual(["birthDate", "email", "phone"]);
  });

  it("exige país cuando no hay dirección", () => {
    expect(fields({ ...completePeru, address: null })).toEqual(["countryId"]);
  });
});
