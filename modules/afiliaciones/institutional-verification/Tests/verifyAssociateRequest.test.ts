import { describe, expect, it } from "vitest";
import { parseVerifyAssociateRequest, VerifyAssociateRequestValidationError } from "../Validators/verifyAssociateRequest";

describe("parseVerifyAssociateRequest", () => {
  it("acepta DNI de exactamente 8 dígitos", () => {
    expect(parseVerifyAssociateRequest({ documentType: "DNI", documentNumber: "12345678" })).toEqual({ documentType: "DNI", documentNumber: "12345678" });
  });

  it.each(["1234567", "123456789", "12a45678", ""])("rechaza DNI inválido: %s", (documentNumber) => {
    expect(() => parseVerifyAssociateRequest({ documentType: "DNI", documentNumber })).toThrow(VerifyAssociateRequestValidationError);
  });

  it("acepta CE entre 9 y 12 caracteres alfanuméricos", () => {
    expect(parseVerifyAssociateRequest({ documentType: "CE", documentNumber: "001234567" })).toEqual({ documentType: "CE", documentNumber: "001234567" });
  });

  it.each(["12345678", "1234567890123", "ABCD-123"])("rechaza CE inválido: %s", (documentNumber) => {
    expect(() => parseVerifyAssociateRequest({ documentType: "CE", documentNumber })).toThrow(VerifyAssociateRequestValidationError);
  });

  it("acepta pasaporte entre 6 y 12 caracteres alfanuméricos y normaliza a mayúsculas", () => {
    expect(parseVerifyAssociateRequest({ documentType: "PASSPORT", documentNumber: " aBc123 " })).toEqual({ documentType: "PASSPORT", documentNumber: "ABC123" });
  });

  it.each(["12345", "1234567890123", "ABC-12"])("rechaza pasaporte inválido: %s", (documentNumber) => {
    expect(() => parseVerifyAssociateRequest({ documentType: "PASSPORT", documentNumber })).toThrow(VerifyAssociateRequestValidationError);
  });

  it("rechaza tipos de documento no soportados", () => {
    expect(() => parseVerifyAssociateRequest({ documentType: "RUC", documentNumber: "20123456789" })).toThrow(VerifyAssociateRequestValidationError);
  });

  it("rechaza claves desconocidas (payload estricto)", () => {
    expect(() => parseVerifyAssociateRequest({ documentType: "DNI", documentNumber: "12345678", extra: true })).toThrow(VerifyAssociateRequestValidationError);
  });

  it("rechaza payloads no objeto o faltantes", () => {
    expect(() => parseVerifyAssociateRequest(null)).toThrow(VerifyAssociateRequestValidationError);
    expect(() => parseVerifyAssociateRequest({ documentType: "DNI" })).toThrow(VerifyAssociateRequestValidationError);
    expect(() => parseVerifyAssociateRequest({ documentNumber: "12345678" })).toThrow(VerifyAssociateRequestValidationError);
  });
});
