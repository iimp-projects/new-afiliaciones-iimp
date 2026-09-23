import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ queryRaw: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { $queryRaw: mocks.queryRaw } }));

import {
  ConfigurationError,
  assertStartupConfig,
  getAppBaseUrl,
  getPaymentAuthSecret,
  getSapConfig,
  getS3Config,
  getSmtpConfig,
  validateStartupConfig,
} from "./env";
import { signEndorsementToken } from "@/modules/afiliaciones/postulacion/Services/EndorsementToken";
import { MailService } from "@/modules/shared/Services/MailService";
import { GET as liveGet } from "@/app/api/health/live/route";
import { GET as readyGet } from "@/app/api/health/ready/route";

const validProd: Record<string, string | undefined> = {
  NODE_ENV: "production",
  AUTH_SECRET: "a".repeat(32),
  AUTH_URL: "https://portal.example",
  NEXT_PUBLIC_APP_URL: "https://portal.example",
  PAYMENT_AUTH_SECRET: "b".repeat(32),
  DATABASE_URL: "postgresql://placeholder@db:5432/app",
};

const issueVariables = (env: Record<string, string | undefined>): string[] =>
  validateStartupConfig(env).issues.map((issue) => issue.variable);

describe("validateStartupConfig", () => {
  it("falla en producción sin AUTH_SECRET", () => {
    const { ok } = validateStartupConfig({ ...validProd, AUTH_SECRET: undefined });
    expect(ok).toBe(false);
    expect(issueVariables({ ...validProd, AUTH_SECRET: undefined })).toContain("AUTH_SECRET");
  });

  it("falla con AUTH_SECRET demasiado corto", () => {
    expect(issueVariables({ ...validProd, AUTH_SECRET: "corto" })).toContain("AUTH_SECRET");
  });

  it("falla con PAYMENT_AUTH_SECRET menor a 32", () => {
    expect(issueVariables({ ...validProd, PAYMENT_AUTH_SECRET: "corto" })).toContain("PAYMENT_AUTH_SECRET");
  });

  it("falla en producción sin DATABASE_URL", () => {
    expect(issueVariables({ ...validProd, DATABASE_URL: undefined })).toContain("DATABASE_URL");
  });

  it("falla con DATABASE_URL no PostgreSQL", () => {
    expect(issueVariables({ ...validProd, DATABASE_URL: "mysql://db:3306/app" })).toContain("DATABASE_URL");
  });

  it("falla con AUTH_URL http en producción", () => {
    expect(issueVariables({ ...validProd, AUTH_URL: "http://portal.example" })).toContain("AUTH_URL");
  });

  it("acepta AUTH_URL https válida y configuración completa", () => {
    expect(validateStartupConfig(validProd).ok).toBe(true);
  });

  it("falla con APP URL localhost en producción", () => {
    expect(issueVariables({ ...validProd, NEXT_PUBLIC_APP_URL: "http://localhost:3000" })).toContain("NEXT_PUBLIC_APP_URL");
  });

  it("permite configuración local en development", () => {
    const dev: Record<string, string | undefined> = {
      NODE_ENV: "development",
      DATABASE_URL: "postgresql://localhost:5432/dev",
      AUTH_URL: "http://localhost:3000",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      AUTH_SECRET: "dev",
      PAYMENT_AUTH_SECRET: "dev",
    };
    expect(validateStartupConfig(dev).ok).toBe(true);
  });

  it("no expone valores de secretos en los mensajes de error", () => {
    const secretValue = "super-secret-value-that-must-not-leak";
    const result = validateStartupConfig({
      ...validProd,
      AUTH_SECRET: secretValue,
      PAYMENT_AUTH_SECRET: secretValue,
      DATABASE_URL: "not-a-url",
    });
    let message = "";
    try {
      assertStartupConfig({
        ...validProd,
        AUTH_SECRET: secretValue,
        PAYMENT_AUTH_SECRET: secretValue,
        DATABASE_URL: "not-a-url",
      });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(result.ok).toBe(false);
    expect(message).not.toContain(secretValue);
    expect(message).toContain("DATABASE_URL");
  });

  it("no bloquea el arranque por SMTP, SAP, S3 ni JWT_SECRET ausentes", () => {
    expect(assertStartupConfig(validProd)).toMatchObject({ isProduction: true });
  });
});

describe("getAppBaseUrl", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("prioriza AUTH_URL y elimina barras finales cuando se solicita", () => {
    const env: Record<string, string | undefined> = { AUTH_URL: "https://portal.example///", NEXT_PUBLIC_APP_URL: "https://fallback.example" };
    expect(getAppBaseUrl(env, { preferAuthUrl: true, allowDevDefault: false })).toBe("https://portal.example");
  });

  it("lanza cuando no hay URL y no se permite el valor de desarrollo", () => {
    expect(() => getAppBaseUrl({ NODE_ENV: "production" }, { allowDevDefault: false })).toThrow(ConfigurationError);
  });

  it("usa localhost solo fuera de producción", () => {
    expect(getAppBaseUrl({ NODE_ENV: "development" })).toBe("http://localhost:3000");
  });
});

describe("feature configuration (lazy)", () => {
  it("getSmtpConfig falla con configuración incompleta", () => {
    expect(() => getSmtpConfig({})).toThrow(ConfigurationError);
  });

  it("getSmtpConfig resuelve SMTP_FROM con fallback a SMTP_USER", () => {
    const config = getSmtpConfig({
      SMTP_HOST: "smtp.example",
      SMTP_PORT: "587",
      SMTP_USER: "user@example",
      SMTP_PASS: "pass",
    });
    expect(config.from).toBe("user@example");
    expect(config.port).toBe(587);
  });

  it("getSapConfig falla sin configuración (sin fallback silencioso)", () => {
    expect(() => getSapConfig({})).toThrow(ConfigurationError);
  });

  it("getS3Config falla sin bucket/región", () => {
    expect(() => getS3Config({})).toThrow(ConfigurationError);
  });

  it("getPaymentAuthSecret exige al menos 32 caracteres", () => {
    expect(() => getPaymentAuthSecret({ PAYMENT_AUTH_SECRET: "corto" })).toThrow(ConfigurationError);
    expect(getPaymentAuthSecret({ PAYMENT_AUTH_SECRET: "x".repeat(32) })).toHaveLength(32);
  });
});

describe("feature failure isolation", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("MailService falla al enviar cuando SMTP está incompleto", async () => {
    vi.stubEnv("SMTP_HOST", "");
    vi.stubEnv("SMTP_PORT", "");
    vi.stubEnv("SMTP_USER", "");
    vi.stubEnv("SMTP_PASS", "");
    await expect(
      new MailService().sendMail({ to: "a@example.com", subject: "s", html: "<p>x</p>" }),
    ).rejects.toBeInstanceOf(ConfigurationError);
  });

  it("JWT_SECRET ausente bloquea la emisión de tokens de aval", () => {
    vi.stubEnv("JWT_SECRET", "");
    expect(() => signEndorsementToken({ applicationId: 1, sponsorPersonId: 2 })).toThrow(ConfigurationError);
  });
});

describe("health endpoints remain dependency-independent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("live responde 200 sin base de datos", async () => {
    const response = await liveGet();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });

  it("ready responde 503 cuando la base de datos falla", async () => {
    mocks.queryRaw.mockRejectedValue(new Error("db down"));
    const response = await readyGet();
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ status: "not_ready" });
  });
});
