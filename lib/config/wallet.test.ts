import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  getAppleWalletConfig,
  getAppleWalletUpdatesEnabled,
  getGoogleWalletConfig,
  getWalletConfig,
  getWalletFlags,
  getWalletProviderMode,
  getWalletSimulationEnabled,
  getWalletSimulationFailure,
  getWalletSyncConfig,
  isCertificateCurrentlyValid,
  isGoogleWalletEmissionAllowed,
  isWalletProviderSimulation,
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

  it("solo permite forzar fallos simulados fuera de producción", () => {
    expect(getWalletSimulationFailure({ NODE_ENV: "development", CARD_WALLET_LOCAL_SIMULATION: "true", CARD_WALLET_LOCAL_SIMULATION_FAILURE: "google" })).toBe("GOOGLE");
    expect(getWalletSimulationFailure({ NODE_ENV: "production", CARD_WALLET_LOCAL_SIMULATION: "true", CARD_WALLET_LOCAL_SIMULATION_FAILURE: "apple" })).toBeNull();
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

  it("permite Google real y Apple simulado simultáneamente en local", () => {
    const env = {
      NODE_ENV: "development",
      CARD_WALLET_LOCAL_SIMULATION: "true",
      CARD_GOOGLE_WALLET_MODE: "REAL",
      CARD_APPLE_WALLET_MODE: "SIMULATION",
    };
    expect(getWalletProviderMode("GOOGLE", env)).toBe("REAL");
    expect(getWalletProviderMode("APPLE", env)).toBe("SIMULATION");
    expect(isWalletProviderSimulation("GOOGLE", env)).toBe(false);
    expect(isWalletProviderSimulation("APPLE", env)).toBe(true);
  });

  it("bloquea la simulación por proveedor en producción", () => {
    const env = {
      NODE_ENV: "production",
      CARD_WALLET_LOCAL_SIMULATION: "true",
      CARD_APPLE_WALLET_MODE: "SIMULATION",
      CARD_GOOGLE_WALLET_MODE: "SIMULATION",
    };
    expect(getWalletProviderMode("GOOGLE", env)).toBe("REAL");
    expect(getWalletProviderMode("APPLE", env)).toBe("REAL");
    expect(isWalletProviderSimulation("APPLE", env)).toBe(false);
  });

  it("resuelve el namespace QA y usa el prefijo histórico por defecto", () => {
    const qa = getGoogleWalletConfig({
      ...googleEnv(),
      GOOGLE_WALLET_CLASS_ID: "338800000001.iimp_membership_qa",
      GOOGLE_WALLET_OBJECT_PREFIX: "iimp_qa_card_",
    });
    expect(qa?.classId).toBe("338800000001.iimp_membership_qa");
    expect(qa?.objectPrefix).toBe("iimp_qa_card_");
    expect(getGoogleWalletConfig(googleEnv())?.objectPrefix).toBe("iimp_card_");
  });

  it("rechaza una clase de un emisor distinto para evitar cruces de entorno", () => {
    expect(getGoogleWalletConfig({ ...googleEnv(), GOOGLE_WALLET_CLASS_ID: "999.otra_clase" })).toBeNull();
  });

  it("aplica allowlist de emisión solo cuando está configurada", () => {
    const open = getGoogleWalletConfig(googleEnv())!;
    expect(isGoogleWalletEmissionAllowed(open, { personId: 5, associateCode: "A-REAL" })).toBe(true);

    const restricted = getGoogleWalletConfig({
      ...googleEnv(),
      CARD_WALLET_ALLOWED_ASSOCIATE_PREFIXES: "QA-TEST-,WLT",
      CARD_WALLET_ALLOWED_PERSON_IDS: "4242",
    })!;
    expect(isGoogleWalletEmissionAllowed(restricted, { personId: 1, associateCode: "QA-TEST-0001" })).toBe(true);
    expect(isGoogleWalletEmissionAllowed(restricted, { personId: 4242, associateCode: null })).toBe(true);
    expect(isGoogleWalletEmissionAllowed(restricted, { personId: 1, associateCode: "A-REAL" })).toBe(false);
  });
});

const fixtureKey = "-----BEGIN ENCRYPTED PRIVATE KEY-----\nZmFrZS1rZXktbWF0ZXJpYWw=\n-----END ENCRYPTED PRIVATE KEY-----\n";
const fixtureDir = mkdtempSync(path.join(tmpdir(), "iimp-wallet-config-"));
const certFile = path.join(fixtureDir, "pass.pem");
const keyFile = path.join(fixtureDir, "pass.key");
const wwdrFile = path.join(fixtureDir, "wwdr.pem");
const invalidFile = path.join(fixtureDir, "invalid.pem");
writeFileSync(certFile, passCertificate);
writeFileSync(keyFile, fixtureKey);
writeFileSync(wwdrFile, wwdrCertificate);
writeFileSync(invalidFile, "esto no es un pem");

afterAll(() => {
  rmSync(fixtureDir, { recursive: true, force: true });
});

function fileEnv(overrides: Record<string, string | undefined> = {}): Record<string, string | undefined> {
  return {
    NODE_ENV: "test",
    APPLE_WALLET_TEAM_ID: "TEAM123456",
    APPLE_WALLET_PASS_TYPE_ID: "pass.pe.org.iimp.carne",
    APPLE_WALLET_PASS_CERT_FILE: certFile,
    APPLE_WALLET_PASS_KEY_FILE: keyFile,
    APPLE_WALLET_WWDR_CERT_FILE: wwdrFile,
    APPLE_WALLET_UPDATES_ENABLED: "false",
    ...overrides,
  };
}

describe("apple wallet credential sources and capabilities", () => {
  it("carga credenciales desde archivos y emite un pase estático", () => {
    const config = getAppleWalletConfig(fileEnv());
    expect(config).not.toBeNull();
    expect(config?.updatesEnabled).toBe(false);
    expect(config?.webServiceUrl).toBeNull();
    expect(config?.authenticationSecret).toBe("");
    expect(config?.certificatePem).toContain("-----BEGIN CERTIFICATE-----");
    expect(config?.keyPassphrase).toBeNull();
  });

  it("mantiene compatibilidad con Base64 y le da precedencia sobre archivo equivalente", () => {
    const config = getAppleWalletConfig(fileEnv({
      APPLE_WALLET_PASS_CERT_B64: Buffer.from(passCertificate).toString("base64"),
      APPLE_WALLET_PASS_KEY_B64: Buffer.from(fixtureKey).toString("base64"),
      APPLE_WALLET_WWDR_CERT_B64: Buffer.from(wwdrCertificate).toString("base64"),
    }));
    expect(config?.passTypeIdentifier).toBe("pass.pe.org.iimp.carne");
  });

  it("mantiene compatibilidad con PEM inline", () => {
    const config = getAppleWalletConfig(fileEnv({
      APPLE_WALLET_PASS_CERT_FILE: undefined,
      APPLE_WALLET_PASS_KEY_FILE: undefined,
      APPLE_WALLET_WWDR_CERT_FILE: undefined,
      APPLE_WALLET_PASS_CERT_PEM: passCertificate,
      APPLE_WALLET_PASS_KEY_PEM: fixtureKey,
      APPLE_WALLET_WWDR_CERT_PEM: wwdrCertificate,
    }));
    expect(config).not.toBeNull();
  });

  it("rechaza fuentes configuradas con contenidos distintos sin exponer valores", () => {
    const env = fileEnv({ APPLE_WALLET_PASS_CERT_B64: Buffer.from(wwdrCertificate).toString("base64") });
    expect(() => getAppleWalletConfig(env)).toThrow(/contenidos PEM distintos/);
    expect(() => getAppleWalletConfig(env)).not.toThrow(/BEGIN CERTIFICATE/);
  });

  it("distingue archivo inexistente de archivo inválido", () => {
    expect(() => getAppleWalletConfig(fileEnv({ APPLE_WALLET_PASS_CERT_FILE: path.join(fixtureDir, "missing.pem") })))
      .toThrow(/no existe/);
    expect(() => getAppleWalletConfig(fileEnv({ APPLE_WALLET_PASS_CERT_FILE: invalidFile })))
      .toThrow(/PEM/);
  });

  it("preserva la passphrase sin recortar espacios", () => {
    const config = getAppleWalletConfig(fileEnv({
      APPLE_WALLET_PASS_KEY_PASSPHRASE: "  clave con espacios  ",
      APPLE_WALLET_OPENSSL_PATH: "C:/Program Files/Git/usr/bin/openssl.exe",
    }));
    expect(config?.keyPassphrase).toBe("  clave con espacios  ");
    expect(config?.opensslPath).toBe("C:/Program Files/Git/usr/bin/openssl.exe");
  });

  it("exige secreto y HTTPS cuando las actualizaciones están habilitadas", () => {
    expect(getAppleWalletConfig(fileEnv({
      APPLE_WALLET_UPDATES_ENABLED: "true",
      APPLE_WALLET_WEB_SERVICE_URL: "https://portal.example/api/afiliaciones/carnet/wallet/apple",
    }))).toBeNull();

    const withSecret = getAppleWalletConfig(fileEnv({
      APPLE_WALLET_UPDATES_ENABLED: "true",
      APPLE_WALLET_WEB_SERVICE_URL: "https://portal.example/api/afiliaciones/carnet/wallet/apple",
      CARD_WALLET_PASS_AUTH_SECRET: "s".repeat(40),
    }));
    expect(withSecret?.updatesEnabled).toBe(true);
    expect(withSecret?.webServiceUrl).toBe("https://portal.example/api/afiliaciones/carnet/wallet/apple");
  });

  it("habilita actualizaciones por defecto para no alterar QA/PROD", () => {
    expect(getAppleWalletUpdatesEnabled({})).toBe(true);
    expect(getAppleWalletUpdatesEnabled({ APPLE_WALLET_UPDATES_ENABLED: "true" })).toBe(true);
    expect(getAppleWalletUpdatesEnabled({ APPLE_WALLET_UPDATES_ENABLED: "false" })).toBe(false);
  });
});
