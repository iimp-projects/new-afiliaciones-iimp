import { describe, expect, it } from "vitest";
import { isDummyLiteral, scanContent, scanLine } from "./scan-secrets.mjs";

describe("isDummyLiteral", () => {
  it("reconoce fixtures explícitamente dummy", () => {
    expect(isDummyLiteral("test-endorsement-secret")).toBe(true);
    expect(isDummyLiteral("dummy-token-value")).toBe(true);
    expect(isDummyLiteral("example")).toBe(true);
    expect(isDummyLiteral("changeme_please")).toBe(true);
  });

  it("no silencia valores que parecen reales", () => {
    expect(isDummyLiteral("testingProdKey1234")).toBe(false);
    expect(isDummyLiteral("AKIA" + "IOSFODNN7EXAMPLE")).toBe(false);
    expect(isDummyLiteral("s3cr3t-production-value")).toBe(false);
  });
});

describe("scanLine", () => {
  it("detecta un secreto hardcodeado no dummy", () => {
    const line = 'api_key = "' + "z".repeat(24) + '"';
    expect(scanLine(line)).toContain("hardcoded-secret");
  });

  it("silencia un fixture dummy", () => {
    const dummy = "test" + "-endorsement-secret";
    expect(scanLine('api_key = "' + dummy + '"')).toEqual([]);
  });

  it("no silencia un secreto real aunque la línea mencione 'example' en un comentario", () => {
    const line = 'api_key = "' + "z".repeat(24) + '" // example';
    expect(scanLine(line)).toContain("hardcoded-secret");
  });

  it("detecta una access key de AWS", () => {
    const key = "AKIA" + "ABCDEFGHIJKLMNOP";
    expect(scanLine("key = " + key)).toContain("aws-access-key");
  });

  it("detecta una URL de base de datos con credenciales", () => {
    const url = "postgres://" + "user:pass" + "@localhost:5432/db";
    expect(scanLine("DATABASE_URL = " + url)).toContain("credentialed-database-url");
  });

  it("detecta una clave privada", () => {
    const marker = "-----BEGIN " + "RSA PRIVATE KEY-----";
    expect(scanLine(marker)).toContain("private-key");
  });
});

describe("scanContent", () => {
  it("reporta la ruta y el número de línea", () => {
    const content = ["const ok = 1;", 'api_key = "' + "z".repeat(24) + '"'].join("\n");
    expect(scanContent(content, "demo.ts")).toEqual(["demo.ts:2 [hardcoded-secret]"]);
  });

  it("no reporta fixtures dummy", () => {
    const dummy = "dummy" + "-value-1234567890";
    expect(scanContent('secret = "' + dummy + '"', "demo.ts")).toEqual([]);
  });
});
