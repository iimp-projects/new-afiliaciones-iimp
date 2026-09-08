import { describe, expect, it } from "vitest";
import { isLegalEntityRuc, isPersonalRucForDocument, isValidDni, isValidRuc, resolveInvoiceType } from "./BillingDocumentRules";

describe("BillingDocumentRules", () => {
  it("validates DNI format", () => {
    expect(isValidDni("12345678")).toBe(true);
    expect(isValidDni("12ABC678")).toBe(false);
    expect(isValidDni("1234")).toBe(false);
  });

  it("validates RUC format", () => {
    expect(isValidRuc("20123456789")).toBe(true);
    expect(isValidRuc("2012345678A")).toBe(false);
    expect(isValidRuc("2012345678")).toBe(false);
    expect(isValidRuc("201234567890")).toBe(false);
  });

  it("recognizes personal RUC only for its DNI", () => {
    expect(isPersonalRucForDocument("10721830130", "72183013")).toBe(true);
    expect(isPersonalRucForDocument("10721830130", "12345678")).toBe(false);
  });

  it("detects legal entity RUC and derives invoice type", () => {
    expect(isLegalEntityRuc("20123456789")).toBe(true);
    expect(isLegalEntityRuc("10123456789")).toBe(false);
    expect(resolveInvoiceType("DNI")).toBe("BOLETA");
    expect(resolveInvoiceType("RUC")).toBe("FACTURA");
  });
});
