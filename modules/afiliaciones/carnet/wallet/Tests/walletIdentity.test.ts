import { describe, expect, it } from "vitest";
import {
  appleWalletSerialNumber,
  cardVerificationUrl,
  deriveApplePassAuthenticationToken,
  googleWalletObjectId,
  verifyApplePassAuthenticationToken,
} from "../Services/walletIdentity";

const activeSecret = "a".repeat(40);
const previousSecret = "b".repeat(40);
const secrets = [
  { version: 2, secret: activeSecret },
  { version: 1, secret: previousSecret },
];

describe("walletIdentity", () => {
  it("genera identificadores estables sin datos personales", () => {
    expect(googleWalletObjectId("3388", "card_abc")).toBe("3388.iimp_card_card_abc");
    expect(appleWalletSerialNumber("card_abc")).toBe("iimp-card-card_abc");
    expect(googleWalletObjectId("3388", "card_abc")).toBe(googleWalletObjectId("3388", "card_abc"));
  });

  it("deriva un token versionado y verifica en tiempo constante", () => {
    const token = deriveApplePassAuthenticationToken(activeSecret, "iimp-card-abc", 2);
    expect(token).toBe(deriveApplePassAuthenticationToken(activeSecret, "iimp-card-abc", 2));
    expect(token.startsWith("2.")).toBe(true);
    expect(verifyApplePassAuthenticationToken(secrets, "iimp-card-abc", token)).toBe(true);
    expect(verifyApplePassAuthenticationToken(secrets, "iimp-card-abc", "otro")).toBe(false);
    expect(verifyApplePassAuthenticationToken([{ version: 2, secret: `${activeSecret}x` }], "iimp-card-abc", token)).toBe(false);
  });

  it("mantiene válidos los tokens emitidos antes de rotar el secreto", () => {
    const previousToken = deriveApplePassAuthenticationToken(previousSecret, "iimp-card-abc", 1);
    expect(verifyApplePassAuthenticationToken(secrets, "iimp-card-abc", previousToken)).toBe(true);
    expect(verifyApplePassAuthenticationToken([{ version: 2, secret: activeSecret }], "iimp-card-abc", previousToken)).toBe(false);
  });

  it("acepta tokens legados sin prefijo solo con la versión 1 disponible", () => {
    const legacy = deriveApplePassAuthenticationToken(previousSecret, "iimp-card-abc", 1).replace(/^1\./, "");
    expect(verifyApplePassAuthenticationToken(secrets, "iimp-card-abc", legacy)).toBe(true);
    expect(verifyApplePassAuthenticationToken([{ version: 2, secret: activeSecret }], "iimp-card-abc", legacy)).toBe(false);
  });

  it("rechaza secretos cortos y versiones inválidas", () => {
    expect(() => deriveApplePassAuthenticationToken("corto", "serial")).toThrow();
    expect(() => deriveApplePassAuthenticationToken(activeSecret, "serial", 0)).toThrow();
  });

  it("construye la URL de verificación existente", () => {
    expect(cardVerificationUrl("https://portal.example/", "tok en")).toBe("https://portal.example/verificar-carnet/tok%20en");
  });
});
