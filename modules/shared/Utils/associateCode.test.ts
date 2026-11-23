import { describe, expect, it } from "vitest";
import { buildAssociateCode } from "./associateCode";

describe("buildAssociateCode", () => {
  it("genera el código A- con al menos cuatro dígitos", () => {
    expect(buildAssociateCode(41)).toBe("A-0041");
    expect(buildAssociateCode(7)).toBe("A-0007");
    expect(buildAssociateCode(12345)).toBe("A-12345");
  });

  it("no genera código sin un ID de persona válido", () => {
    expect(buildAssociateCode(null)).toBeNull();
    expect(buildAssociateCode(undefined)).toBeNull();
    expect(buildAssociateCode(0)).toBeNull();
    expect(buildAssociateCode(-1)).toBeNull();
    expect(buildAssociateCode(1.5)).toBeNull();
  });
});
