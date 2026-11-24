import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { extractVerificationToken } from "../Utils/accessToken";

const BASES = ["https://afiliaciones.iimp.org.pe", "http://localhost:3000"];
const TOKEN = randomBytes(18).toString("base64url");

describe("extractVerificationToken", () => {
  it("acepta un token crudo del lector USB", () => {
    expect(extractVerificationToken(TOKEN, BASES)).toBe(TOKEN);
  });

  it("extrae el token desde una URL de verificación del dominio permitido", () => {
    expect(extractVerificationToken(`https://afiliaciones.iimp.org.pe/verificar-carnet/${TOKEN}`, BASES)).toBe(TOKEN);
    expect(extractVerificationToken(`http://localhost:3000/verificar-carnet/${TOKEN}/`, BASES)).toBe(TOKEN);
  });

  it("rechaza dominios no permitidos (anti-SSRF)", () => {
    expect(extractVerificationToken(`https://evil.example/verificar-carnet/${TOKEN}`, BASES)).toBeNull();
  });

  it("rechaza rutas y protocolos no permitidos", () => {
    expect(extractVerificationToken(`https://afiliaciones.iimp.org.pe/otra/${TOKEN}`, BASES)).toBeNull();
    expect(extractVerificationToken(`javascript:alert(1)`, BASES)).toBeNull();
    expect(extractVerificationToken(`ftp://afiliaciones.iimp.org.pe/verificar-carnet/${TOKEN}`, BASES)).toBeNull();
  });

  it("rechaza entradas vacías, demasiado largas o con formato incorrecto", () => {
    expect(extractVerificationToken("", BASES)).toBeNull();
    expect(extractVerificationToken("no-es-un-token", BASES)).toBeNull();
    expect(extractVerificationToken("x".repeat(3000), BASES)).toBeNull();
  });
});
