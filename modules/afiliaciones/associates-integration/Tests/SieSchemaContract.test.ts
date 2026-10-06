import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const schema = readFileSync(resolve(process.cwd(), "prisma", "schema.prisma"), "utf8");

function modelBlock(modelName: string): string {
  const match = schema.match(new RegExp(`model ${modelName} \\{([\\s\\S]*?)\\n\\}`));
  if (!match) throw new Error(`Modelo ${modelName} no encontrado`);
  return match[1];
}

describe("R69.3 schema contract", () => {
  it("externalCode es String", () => {
    expect(modelBlock("SieAssociateRecord")).toMatch(/externalCode\s+String\s+@map/);
  });

  it("documentNumber es String", () => {
    expect(modelBlock("SieAssociateRecord")).toMatch(/documentNumber\s+String\?/);
  });

  it("provider + externalCode es único", () => {
    expect(modelBlock("SieAssociateRecord")).toMatch(/@@unique\(\[provider, externalCode\]\)/);
  });

  it("NO impone unique(provider, personId)", () => {
    const block = modelBlock("SieAssociateRecord");
    expect(block).not.toMatch(/@@unique\(\[provider, personId\]\)/);
    expect(block).not.toMatch(/@@unique\(\[personId\]\)/);
  });

  it("personId es nullable", () => {
    expect(modelBlock("SieAssociateRecord")).toMatch(/personId\s+Int\?/);
  });

  it("no existe columna de password/Clave/secret en los modelos persistentes", () => {
    for (const block of [modelBlock("SieAssociateRecord"), modelBlock("MembershipCategory")]) {
      expect(block).not.toMatch(/Clave/i);
      expect(block).not.toMatch(/password/i);
      expect(block).not.toMatch(/secret/i);
    }
  });

  it("MembershipCategory no tiene FK obligatoria a Role", () => {
    expect(modelBlock("MembershipCategory")).not.toMatch(/roleId\s+Int/);
  });
});
