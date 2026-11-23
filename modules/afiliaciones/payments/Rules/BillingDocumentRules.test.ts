import { describe, expect, it } from "vitest";
import {
  hasValidRucCheckDigit,
  isLegalEntityRuc,
  isPersonalRucForDocument,
  isValidBillingDocument,
  isValidBillingEmail,
  isValidBillingName,
  isValidCe,
  isValidDni,
  isValidFiscalAddress,
  isValidPassport,
  isValidRuc,
  resolveInvoiceType,
  sanitizeBillingDocumentNumber,
} from "./BillingDocumentRules";

describe("BillingDocumentRules", () => {
  it("validates DNI format", () => {
    expect(isValidDni("12345678")).toBe(true);
    expect(isValidDni("12ABC678")).toBe(false);
    expect(isValidDni("1234")).toBe(false);
  });

  it("validates RUC length and check digit", () => {
    expect(isValidRuc("20123456786")).toBe(true);
    expect(isValidRuc("20123456789")).toBe(false);
    expect(isValidRuc("2012345678A")).toBe(false);
    expect(isValidRuc("2012345678")).toBe(false);
    expect(isValidRuc("201234567890")).toBe(false);
    expect(hasValidRucCheckDigit("20123456786")).toBe(true);
    expect(hasValidRucCheckDigit("20123456789")).toBe(false);
  });

  it("validates CE as alphanumeric up to 15 characters", () => {
    expect(isValidCe("00123456")).toBe(true);
    expect(isValidCe("AB123456")).toBe(true);
    expect(isValidCe("AB-123")).toBe(false);
    expect(isValidCe("A".repeat(16))).toBe(false);
  });

  it("validates passport as alphanumeric between 6 and 12 characters", () => {
    expect(isValidPassport("AB123456")).toBe(true);
    expect(isValidPassport("AB123")).toBe(false);
    expect(isValidPassport("P12345")).toBe(true);
    expect(isValidPassport("AB-123456")).toBe(false);
    expect(isValidPassport("A".repeat(13))).toBe(false);
  });

  it("validates billing document per type", () => {
    expect(isValidBillingDocument("DNI", "12345678")).toBe(true);
    expect(isValidBillingDocument("CE", "AB123456")).toBe(true);
    expect(isValidBillingDocument("PASSPORT", "AB123456")).toBe(true);
    expect(isValidBillingDocument("RUC", "20123456786")).toBe(true);
    expect(isValidBillingDocument("RUC", "20123456789")).toBe(false);
    expect(isValidBillingDocument("CE", "AB-123")).toBe(false);
    expect(isValidBillingDocument("PASSPORT", "AB123")).toBe(false);
  });

  it("normalizes document numbers per type", () => {
    expect(sanitizeBillingDocumentNumber("DNI", "12-34-5678")).toBe("12345678");
    expect(sanitizeBillingDocumentNumber("RUC", "20 1234 56786")).toBe("20123456786");
    expect(sanitizeBillingDocumentNumber("CE", "ab-123")).toBe("AB123");
    expect(sanitizeBillingDocumentNumber("PASSPORT", "ab-123456")).toBe("AB123456");
  });

  it("recognizes personal RUC only for its DNI", () => {
    expect(isPersonalRucForDocument("10721830131", "72183013")).toBe(true);
    expect(isPersonalRucForDocument("10721830131", "12345678")).toBe(false);
    expect(isPersonalRucForDocument("10721830130", "72183013")).toBe(false);
  });

  it("detects legal entity RUC and derives invoice type", () => {
    expect(isLegalEntityRuc("20123456786")).toBe(true);
    expect(isLegalEntityRuc("10123456780")).toBe(false);
    expect(resolveInvoiceType("DNI")).toBe("BOLETA");
    expect(resolveInvoiceType("CE")).toBe("BOLETA");
    expect(resolveInvoiceType("PASSPORT")).toBe("BOLETA");
    expect(resolveInvoiceType("RUC")).toBe("FACTURA");
  });

  it("validates billing names, addresses and emails", () => {
    expect(isValidBillingName("Ana Pérez")).toBe(true);
    expect(isValidBillingName("Empresa 123 S.A.C.")).toBe(true);
    expect(isValidBillingName("   ")).toBe(false);
    expect(isValidBillingName("!!!")).toBe(false);
    expect(isValidBillingName("x".repeat(251))).toBe(false);

    expect(isValidFiscalAddress("Av. Principal 123")).toBe(true);
    expect(isValidFiscalAddress("Av.1")).toBe(false);
    expect(isValidFiscalAddress("!!!!")).toBe(false);
    expect(isValidFiscalAddress("x".repeat(251))).toBe(false);

    expect(isValidBillingEmail("facturacion@example.com")).toBe(true);
    expect(isValidBillingEmail("facturacion@example.com.pe")).toBe(true);
    expect(isValidBillingEmail("sin-arroba")).toBe(false);
    expect(isValidBillingEmail("doble@@example.com")).toBe(false);
    expect(isValidBillingEmail(`${"a".repeat(140)}@example.com`)).toBe(false);
  });
});
