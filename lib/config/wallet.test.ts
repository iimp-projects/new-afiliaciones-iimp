import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  getAppleWalletConfig,
  getGoogleWalletConfig,
  getWalletConfig,
  getWalletFlags,
  getWalletSimulationEnabled,
  getWalletSyncConfig,
  isCertificateCurrentlyValid,
} from "./wallet";

const baseUrl = "https://portal.example";

function googleEnv(classId = "class-1"): Record<string, string | undefined> {
  return {
    NODE_ENV: "test",
    NEXT_PUBLIC_APP_URL: baseUrl,
    CARD_GOOGLE_WALLET_ENABLED: "true",
    GOOGLE_WALLET_ISSUER_ID: "338800000001",
    GOOGLE_WALLET_CLASS_ID: classId,
    GOOGLE_WALLET_SERVICE_ACCOUNT_JSON: JSON.stringify({
      client_email: "wallet@example.iam.gserviceaccount.com",
      private_key: "-----BEGIN TEST KEY-----\nclave\n-----END TEST KEY-----",
    }),
  };
}

const passCertificate = readFileSync("modules/afiliaciones/carnet/wallet/Tests/fixtures/pass-cert.pem", "utf8");
const wwdrCertificate = readFileSync("modules/afiliaciones/carnet/wallet/Tests/fixtures/wwdr-cert.pem", "utf8");

function appleEnv(): Record<string, string | undefined> {
  const key = `-----BEGIN TEST KEY-----\ncontenido\n-----END TEST KEY-----`;
  return {
    NODE_ENV: "test",
    NEXT_PUBLIC_APP_URL: baseUrl,
    CARD_APPLE_WALLET_ENABLED: "true",
    APPLE_WALLET_TEAM_ID: "TEAM123456",
    APPLE_WALLET_PASS_TYPE_ID: "pass.pe.org.iimp.carne",
    APPLE_WALLET_WEB_SERVICE_URL: "https://portal.example/api/afiliaciones/carnet/wallet/apple",
    APPLE_WALLET_PASS_CERT_B64: Buffer.from(passCertificate).toString("base64"),
    APPLE_WALLET_PASS_KEY_B64: Buffer.from(key).toString("base64"),
    APPLE_WALLET_WWDR_CERT_B64: Buffer.from(wwdrCertificate).toString("base64"),
    CARD_WALLET_PASS_AUTH_SECRET: "s".repeat(40),
  };
}

describe("wallet config", () => {
  it("deshabilita ambos proveedores por defecto", () => {
    expect(getWalletFlags({})).toEqual({ googleEnabled: false, appleEnabled: false });
    expect(getWalletConfig({ NODE_ENV: "test", NEXT_PUBLIC_APP_URL: baseUrl }).google).toBeNull();
  });

  it("normaliza el classId de Google con el issuer", () => {
    expect(getGoogleWalletConfig(googleEnv())?.classId).toBe("338800000001.class-1");
    expect(getGoogleWalletConfig(googleEnv("338800000001.class-2"))?.classId).toBe("338800000001.class-2");
  });

  it("no considera configurado Google sin cuenta de servicio", () => {
    const env = { ...googleEnv(), GOOGLE_WALLET_SERVICE_ACCOUNT_JSON: undefined };
    expect(getGoogleWalletConfig(env)).toBeNull();
  });

  it("rechaza un JSON de cuenta de servicio inválido sin exponer valores", () => {
    const env = { ...googleEnv(), GOOGLE_WALLET_SERVICE_ACCOUNT_JSON: "{invalido" };
    expect(() => getGoogleWalletConfig(env)).toThrow(/GOOGLE_WALLET_SERVICE_ACCOUNT_JSON/);
    expect(() => getGoogleWalletConfig(env)).not.toThrow(/clave/);
  });

  it("resuelve Apple Wallet con certificados y secreto", () => {
    const config = getAppleWalletConfig(appleEnv());
    expect(config?.passTypeIdentifier).toBe("pass.pe.org.iimp.carne");
    expect(config?.webServiceUrl).toBe("https://portal.example/api/afiliaciones/carnet/wallet/apple");
    expect(config?.authenticationSecret).toHaveLength(40);
  });

  it("no configura Apple Wallet sobre HTTP", () => {
    const env = { ...appleEnv(), APPLE_WALLET_WEB_SERVICE_URL: "http://localhost:3000/api" };
    expect(getAppleWalletConfig(env)).toBeNull();
  });

  it("rechaza certificados inválidos o vencidos", () => {
    expect(isCertificateCurrentlyValid(passCertificate)).toBe(true);
    expect(isCertificateCurrentlyValid(passCertificate, new Date("2050-01-01T00:00:00Z"))).toBe(false);
    expect(isCertificateCurrentlyValid("no-es-pem")).toBe(false);
    const env = {
      ...appleEnv(),
      APPLE_WALLET_PASS_CERT_B64: Buffer.from("-----BEGIN CERTIFICATE-----\nno-es-certificado\n-----END CERTIFICATE-----").toString("base64"),
    };
    expect(getAppleWalletConfig(env)).toBeNull();
  });

  it("versiona el secreto HMAC y conserva el anterior durante la rotación", () => {
    const env = {
      ...appleEnv(),
      CARD_WALLET_PASS_AUTH_SECRET_VERSION: "2",
      CARD_WALLET_PASS_AUTH_SECRET_PREVIOUS: "p".repeat(40),
      CARD_WALLET_PASS_AUTH_SECRET_PREVIOUS_VERSION: "1",
    };
    const config = getAppleWalletConfig(env);
    expect(config?.authenticationSecretVersion).toBe(2);
    expect(config?.previousAuthenticationSecretVersion).toBe(1);
    expect(config?.previousAuthenticationSecret).toBe("p".repeat(40));
  });

  it("solo habilita la simulación local fuera de producción", () => {
    expect(getWalletSimulationEnabled({ NODE_ENV: "development", CARD_WALLET_LOCAL_SIMULATION: "true" })).toBe(true);
    expect(getWalletSimulationEnabled({ NODE_ENV: "test", CARD_WALLET_LOCAL_SIMULATION: "1" })).toBe(false);
    expect(getWalletSimulationEnabled({ NODE_ENV: "production", CARD_WALLET_LOCAL_SIMULATION: "true" })).toBe(false);
    expect(getWalletSimulationEnabled({ NODE_ENV: "development" })).toBe(false);
  });

  it("resuelve la configuración del procesador con límites válidos", () => {
    const config = getWalletSyncConfig({
      CARD_WALLET_SYNC_ENABLED: "true",
      CARD_WALLET_SYNC_BATCH_SIZE: "10",
      CARD_WALLET_SYNC_MAX_ATTEMPTS: "5",
      CARD_WALLET_SYNC_LEASE_SECONDS: "90",
      CARD_WALLET_SYNC_INTERVAL_SECONDS: "30",
    });
    expect(config).toEqual({ enabled: true, batchSize: 10, maxAttempts: 5, leaseSeconds: 90, intervalSeconds: 30 });
  });
});
