import { describe, expect, it } from "vitest";
import { documentTypeLabel } from "./documentType";

describe("documentTypeLabel", () => {
  it("muestra DNI para el tipo DNI", () => {
    expect(documentTypeLabel("DNI")).toBe("DNI");
  });

  it("muestra CE para el carné de extranjería", () => {
    expect(documentTypeLabel("CE")).toBe("CE");
  });

  it("muestra Pasaporte para PASSPORT", () => {
    expect(documentTypeLabel("PASSPORT")).toBe("Pasaporte");
  });

  it("muestra Documento para OTHER", () => {
    expect(documentTypeLabel("OTHER")).toBe("Documento");
  });

  it("muestra Documento para null y undefined", () => {
    expect(documentTypeLabel(null)).toBe("Documento");
    expect(documentTypeLabel(undefined)).toBe("Documento");
  });

  it("muestra Documento para valores desconocidos", () => {
    expect(documentTypeLabel("XYZ")).toBe("Documento");
    expect(documentTypeLabel("")).toBe("Documento");
  });
});
