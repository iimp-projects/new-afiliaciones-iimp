import { describe, expect, it } from "vitest";
import { formatAssociateCode, parseAssociateCodeNumber, resolveAssociateCode } from "./associateCode";

describe("formatAssociateCode", () => {
  it("genera el código A- con al menos cinco dígitos", () => {
    expect(formatAssociateCode(41)).toBe("A-00041");
    expect(formatAssociateCode(7)).toBe("A-00007");
    expect(formatAssociateCode(12345)).toBe("A-12345");
  });

  it("rechaza un correlativo inválido", () => {
    expect(() => formatAssociateCode(0)).toThrow();
    expect(() => formatAssociateCode(-1)).toThrow();
    expect(() => formatAssociateCode(1.5)).toThrow();
  });
});

describe("parseAssociateCodeNumber", () => {
  it("extrae el correlativo de un código válido", () => {
    expect(parseAssociateCodeNumber("A-00041")).toBe(41);
    expect(parseAssociateCodeNumber(" A-12345 ")).toBe(12345);
  });

  it("devuelve null para códigos inválidos o vacíos", () => {
    expect(parseAssociateCodeNumber(null)).toBeNull();
    expect(parseAssociateCodeNumber(undefined)).toBeNull();
    expect(parseAssociateCodeNumber("")).toBeNull();
    expect(parseAssociateCodeNumber("0041")).toBeNull();
    expect(parseAssociateCodeNumber("A-")).toBeNull();
  });
});

describe("resolveAssociateCode", () => {
  it("devuelve el código almacenado o null", () => {
    expect(resolveAssociateCode({ associateCode: "A-00041" })).toBe("A-00041");
    expect(resolveAssociateCode({ associateCode: "  " })).toBeNull();
    expect(resolveAssociateCode(null)).toBeNull();
    expect(resolveAssociateCode(undefined)).toBeNull();
  });
});
