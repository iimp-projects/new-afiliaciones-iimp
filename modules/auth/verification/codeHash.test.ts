import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hashVerificationCode, legacyHashVerificationCode, verificationCodeCandidates } from "./codeHash";

describe("verification code hashing", () => {
  beforeEach(() => {
    vi.stubEnv("AUTH_SECRET", "test-auth-secret");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("creación de tokens", () => {
    it("crea HMAC-SHA256 con AUTH_SECRET válido", () => {
      const hmac = hashVerificationCode("123456");
      expect(hmac).toMatch(/^[0-9a-f]{64}$/);
      expect(hmac).not.toBe(legacyHashVerificationCode("123456"));
    });

    it("es determinista y sensible al código", () => {
      expect(hashVerificationCode("123456")).toBe(hashVerificationCode("123456"));
      expect(hashVerificationCode("123456")).not.toBe(hashVerificationCode("654321"));
    });

    it("falla con error de configuración si falta AUTH_SECRET", () => {
      vi.stubEnv("AUTH_SECRET", "");
      expect(() => hashVerificationCode("123456")).toThrow(/AUTH_SECRET no configurado/);
    });

    it("falla si AUTH_SECRET es solo espacios", () => {
      vi.stubEnv("AUTH_SECRET", "   ");
      expect(() => hashVerificationCode("123456")).toThrow(/AUTH_SECRET no configurado/);
    });
  });

  describe("verificación", () => {
    it("acepta un HMAC válido", () => {
      expect(verificationCodeCandidates("123456")).toContain(hashVerificationCode("123456"));
    });

    it("no acepta un HMAC inválido", () => {
      expect(verificationCodeCandidates("123456")).not.toContain(hashVerificationCode("654321"));
    });

    it("acepta un SHA-256 legacy válido", () => {
      expect(verificationCodeCandidates("123456")).toContain(legacyHashVerificationCode("123456"));
    });

    it("no acepta un SHA-256 legacy inválido", () => {
      expect(verificationCodeCandidates("123456")).not.toContain(legacyHashVerificationCode("654321"));
    });

    it("sin AUTH_SECRET acepta legacy pero no puede validar HMAC", () => {
      const hmac = hashVerificationCode("123456");
      vi.stubEnv("AUTH_SECRET", "");
      const candidates = verificationCodeCandidates("123456");
      expect(candidates).toEqual([legacyHashVerificationCode("123456")]);
      expect(candidates).not.toContain(hmac);
    });
  });
});
