import { describe, expect, it } from "vitest";
import { findMissingCardholderData, type CardholderDataSource } from "../Rules/CardholderDataRules";

const complete: CardholderDataSource = {
  email: "applicant@example.com",
  phone: "999999999",
  personId: 7,
  documentNumber: "12345678",
  address: {
    street: "Av. Prueba 123",
    city: "Lima",
    state: "Lima",
    countryCode: "PER",
    postalCode: "15024",
  },
};

const missingFields = (source: CardholderDataSource) =>
  findMissingCardholderData(source).map((item) => item.field);

describe("CardholderDataRules — datos obligatorios para pago", () => {
  it("acepta un titular con todos los datos requeridos", () => {
    expect(findMissingCardholderData(complete)).toEqual([]);
  });

  it("acepta el código postal ausente porque es opcional", () => {
    const result = findMissingCardholderData({
      ...complete,
      address: { ...complete.address!, postalCode: null },
    });

    expect(result).toEqual([]);
  });

  it("reporta todos los campos de dirección cuando no hay dirección", () => {
    expect(missingFields({ ...complete, address: null })).toEqual([
      "address",
      "city",
      "state",
      "country",
    ]);
  });

  it("trata valores vacíos o con espacios como faltantes", () => {
    expect(missingFields({
      ...complete,
      email: "  ",
      phone: "",
      address: { ...complete.address!, street: "   " },
    })).toEqual(["email", "phone", "address"]);
  });

  it("acepta documentNumber como identificador cuando no hay personId", () => {
    expect(missingFields({ ...complete, personId: null })).toEqual([]);
    expect(missingFields({ ...complete, personId: null, documentNumber: "" })).toEqual(["identityDocument"]);
  });
});
