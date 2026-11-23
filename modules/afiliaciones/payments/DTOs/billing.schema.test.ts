import { describe, expect, it } from "vitest";
import { billingDataSchema, type BillingDataInput } from "./billing.schema";

const base: BillingDataInput = {
  tipoDocumento: "DNI",
  numeroDocumento: "12345678",
  razonSocial: "Ana Pérez",
  direccionFiscal: "Av. Principal 123",
  responsable: "Ana Pérez",
  emailFacturacion: "facturacion@example.com",
};

const valid = (overrides: Partial<BillingDataInput> = {}) => billingDataSchema.safeParse({ ...base, ...overrides }).success;

describe("billingDataSchema — reglas de facturación", () => {
  it("acepta DNI, CE, PASSPORT y RUC válidos", () => {
    expect(valid()).toBe(true);
    expect(valid({ tipoDocumento: "CE", numeroDocumento: "AB123456" })).toBe(true);
    expect(valid({ tipoDocumento: "PASSPORT", numeroDocumento: "AB123456" })).toBe(true);
    expect(valid({ tipoDocumento: "RUC", numeroDocumento: "20123456786" })).toBe(true);
  });

  it("rechaza documentos inválidos por tipo", () => {
    expect(valid({ numeroDocumento: "1234567" })).toBe(false);
    expect(valid({ tipoDocumento: "CE", numeroDocumento: "AB-123" })).toBe(false);
    expect(valid({ tipoDocumento: "CE", numeroDocumento: "A".repeat(16) })).toBe(false);
    expect(valid({ tipoDocumento: "PASSPORT", numeroDocumento: "AB123" })).toBe(false);
    expect(valid({ tipoDocumento: "PASSPORT", numeroDocumento: "AB-123456" })).toBe(false);
    expect(valid({ tipoDocumento: "PASSPORT", numeroDocumento: "A".repeat(13) })).toBe(false);
    expect(valid({ tipoDocumento: "RUC", numeroDocumento: "2012345678" })).toBe(false);
    expect(valid({ tipoDocumento: "RUC", numeroDocumento: "20123456789" })).toBe(false);
  });

  it("normaliza el número de documento a mayúsculas", () => {
    const parsed = billingDataSchema.safeParse({ ...base, tipoDocumento: "CE", numeroDocumento: "ab123456" });
    expect(parsed.success && parsed.data.numeroDocumento).toBe("AB123456");
    const passport = billingDataSchema.safeParse({ ...base, tipoDocumento: "PASSPORT", numeroDocumento: "ab123456" });
    expect(passport.success && passport.data.numeroDocumento).toBe("AB123456");
  });

  it("exige razón social con contenido válido", () => {
    expect(valid({ razonSocial: "" })).toBe(false);
    expect(valid({ razonSocial: "   " })).toBe(false);
    expect(valid({ razonSocial: "!!!" })).toBe(false);
    expect(valid({ razonSocial: "x".repeat(251) })).toBe(false);
  });

  it("exige dirección fiscal válida", () => {
    expect(valid({ direccionFiscal: "" })).toBe(false);
    expect(valid({ direccionFiscal: "Av.1" })).toBe(false);
    expect(valid({ direccionFiscal: "!!!!" })).toBe(false);
    expect(valid({ direccionFiscal: "x".repeat(251) })).toBe(false);
  });

  it("exige responsable y correo de facturación válidos", () => {
    expect(valid({ responsable: "" })).toBe(false);
    expect(valid({ responsable: "x".repeat(151) })).toBe(false);
    expect(valid({ emailFacturacion: "" })).toBe(false);
    expect(valid({ emailFacturacion: "sin-arroba" })).toBe(false);
    expect(valid({ emailFacturacion: "correo@dominio" })).toBe(false);
    expect(valid({ emailFacturacion: `${"a".repeat(140)}@example.com` })).toBe(false);
  });
});
