import { z } from "zod";

/**
 * Configuración central y tipada de la aplicación.
 *
 * Reglas de diseño:
 * - Server-only: ningún componente cliente debe importar este módulo.
 * - Los errores indican únicamente el NOMBRE de la variable y el motivo; nunca
 *   el valor (por eso nunca se interpolan valores en los mensajes).
 * - La validación de arranque (assertStartupConfig) se ejecuta en runtime del
 *   servidor, no durante `next build` (ver instrumentation.ts).
 * - Las integraciones opcionales se validan al utilizarse, no al arrancar.
 */

export type NodeEnv = "development" | "test" | "production";

/** Fuente de variables de entorno (compatible con `process.env`). */
export type EnvSource = Readonly<Record<string, string | undefined>>;

export interface ConfigIssue {
  readonly variable: string;
  readonly reason: string;
}

export class ConfigurationError extends Error {
  readonly issues: readonly ConfigIssue[];

  constructor(issues: readonly ConfigIssue[]) {
    const summary = issues.map((issue) => `${issue.variable} (${issue.reason})`).join("; ");
    super(`Configuración inválida: ${summary}`);
    this.name = "ConfigurationError";
    this.issues = issues;
  }
}

const nodeEnvSchema = z.enum(["development", "test", "production"]);

function isPostgresUrl(value: string): boolean {
  try {
    const protocol = new URL(value).protocol;
    return protocol === "postgresql:" || protocol === "postgres:";
  } catch {
    return false;
  }
}

function isHttpUrl(value: string): boolean {
  try {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function stripTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, "");
}

export function getNodeEnv(env: EnvSource = process.env): NodeEnv {
  if (env.NODE_ENV === undefined) return "development";
  const parsed = nodeEnvSchema.safeParse(env.NODE_ENV);
  if (!parsed.success) {
    throw new ConfigurationError([{ variable: "NODE_ENV", reason: "debe ser development, test o production" }]);
  }
  return parsed.data;
}

export interface StartupConfig {
  readonly nodeEnv: NodeEnv;
  readonly isProduction: boolean;
  readonly databaseUrl?: string;
  readonly authSecret?: string;
  readonly authUrl?: string;
  readonly appUrl?: string;
  readonly paymentAuthSecret?: string;
}

export interface StartupValidation {
  readonly ok: boolean;
  readonly issues: readonly ConfigIssue[];
  readonly config: StartupConfig;
}

/**
 * Valida la configuración crítica de arranque.
 *
 * - En producción: AUTH_SECRET, AUTH_URL (https), NEXT_PUBLIC_APP_URL (https),
 *   PAYMENT_AUTH_SECRET (>=32) y DATABASE_URL son obligatorios.
 * - En development/test: no se exige presencia, pero si una URL está presente
 *   debe ser válida. Nunca se valida conectividad aquí.
 */
export function validateStartupConfig(env: EnvSource = process.env): StartupValidation {
  const issues: ConfigIssue[] = [];
  const parsedNodeEnv = env.NODE_ENV === undefined ? undefined : nodeEnvSchema.safeParse(env.NODE_ENV);
  if (parsedNodeEnv && !parsedNodeEnv.success) {
    issues.push({ variable: "NODE_ENV", reason: "debe ser development, test o production" });
  }
  const nodeEnv: NodeEnv = parsedNodeEnv?.success ? parsedNodeEnv.data : "development";
  const isProduction = nodeEnv === "production";

  const databaseUrl = env.DATABASE_URL?.trim();
  if (databaseUrl) {
    if (!isPostgresUrl(databaseUrl)) {
      issues.push({ variable: "DATABASE_URL", reason: "debe ser una URL PostgreSQL válida" });
    }
  } else if (isProduction) {
    issues.push({ variable: "DATABASE_URL", reason: "es obligatorio en producción" });
  }

  const authSecret = env.AUTH_SECRET?.trim();
  if (isProduction) {
    if (!authSecret) issues.push({ variable: "AUTH_SECRET", reason: "es obligatorio en producción" });
    else if (authSecret.length < 32) issues.push({ variable: "AUTH_SECRET", reason: "debe tener al menos 32 caracteres" });
  }

  const authUrl = env.AUTH_URL?.trim();
  if (authUrl) {
    if (!isHttpUrl(authUrl)) issues.push({ variable: "AUTH_URL", reason: "debe ser una URL válida" });
    else if (isProduction && !isHttpsUrl(authUrl)) issues.push({ variable: "AUTH_URL", reason: "debe usar https en producción" });
  } else if (isProduction) {
    issues.push({ variable: "AUTH_URL", reason: "es obligatorio en producción" });
  }

  const appUrl = env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl) {
    if (!isHttpUrl(appUrl)) issues.push({ variable: "NEXT_PUBLIC_APP_URL", reason: "debe ser una URL válida" });
    else if (isProduction && !isHttpsUrl(appUrl)) issues.push({ variable: "NEXT_PUBLIC_APP_URL", reason: "debe usar https en producción" });
  } else if (isProduction) {
    issues.push({ variable: "NEXT_PUBLIC_APP_URL", reason: "es obligatorio en producción" });
  }

  const paymentAuthSecret = env.PAYMENT_AUTH_SECRET;
  if (isProduction) {
    if (!paymentAuthSecret) issues.push({ variable: "PAYMENT_AUTH_SECRET", reason: "es obligatorio en producción" });
    else if (paymentAuthSecret.length < 32) issues.push({ variable: "PAYMENT_AUTH_SECRET", reason: "debe tener al menos 32 caracteres" });
  }

  return {
    ok: issues.length === 0,
    issues,
    config: {
      nodeEnv,
      isProduction,
      databaseUrl,
      authSecret,
      authUrl,
      appUrl,
      paymentAuthSecret,
    },
  };
}

/** Falla el arranque si la configuración crítica de producción es inválida. */
export function assertStartupConfig(env: EnvSource = process.env): StartupConfig {
  const result = validateStartupConfig(env);
  if (!result.ok) throw new ConfigurationError(result.issues);
  return result.config;
}

// ---------------------------------------------------------------------------
// Getters de secretos del servidor
// ---------------------------------------------------------------------------

export function getAuthSecret(env: EnvSource = process.env): string {
  const value = env.AUTH_SECRET?.trim();
  if (!value) throw new ConfigurationError([{ variable: "AUTH_SECRET", reason: "es obligatorio" }]);
  return value;
}

export function getPaymentAuthSecret(env: EnvSource = process.env): string {
  const value = env.PAYMENT_AUTH_SECRET;
  if (!value || value.length < 32) {
    throw new ConfigurationError([{ variable: "PAYMENT_AUTH_SECRET", reason: "debe tener al menos 32 caracteres" }]);
  }
  return value;
}

export function getJwtSecret(env: EnvSource = process.env): string {
  const value = env.JWT_SECRET?.trim();
  if (!value) throw new ConfigurationError([{ variable: "JWT_SECRET", reason: "es obligatorio" }]);
  return value;
}

// ---------------------------------------------------------------------------
// URL base de la aplicación
// ---------------------------------------------------------------------------

export interface AppBaseUrlOptions {
  /** Prioriza AUTH_URL sobre NEXT_PUBLIC_APP_URL (flujo de activación). */
  readonly preferAuthUrl?: boolean;
  /** Permite el valor por defecto de desarrollo cuando no hay URL configurada. */
  readonly allowDevDefault?: boolean;
}

/**
 * Resuelve la URL base del servidor. Elimina los fallbacks productivos
 * peligrosos: en producción exige una URL configurada y válida.
 */
export function getAppBaseUrl(env: EnvSource = process.env, options: AppBaseUrlOptions = {}): string {
  const allowDevDefault = options.allowDevDefault ?? true;
  const candidates: ReadonlyArray<{ variable: string; value?: string }> = options.preferAuthUrl
    ? [
        { variable: "AUTH_URL", value: env.AUTH_URL },
        { variable: "NEXT_PUBLIC_APP_URL", value: env.NEXT_PUBLIC_APP_URL },
        { variable: "APP_URL", value: env.APP_URL },
      ]
    : [
        { variable: "NEXT_PUBLIC_APP_URL", value: env.NEXT_PUBLIC_APP_URL },
        { variable: "AUTH_URL", value: env.AUTH_URL },
        { variable: "APP_URL", value: env.APP_URL },
      ];

  for (const candidate of candidates) {
    const value = candidate.value?.trim();
    if (!value) continue;
    if (!isHttpUrl(value)) {
      throw new ConfigurationError([{ variable: candidate.variable, reason: "debe ser una URL válida" }]);
    }
    return stripTrailingSlashes(value);
  }

  if (allowDevDefault && env.NODE_ENV !== "production") return "http://localhost:3000";
  throw new ConfigurationError([{ variable: "NEXT_PUBLIC_APP_URL", reason: "es obligatorio" }]);
}

// ---------------------------------------------------------------------------
// Integraciones (validación al utilizarse, nunca bloquean el arranque)
// ---------------------------------------------------------------------------

export interface SmtpConfig {
  readonly host: string;
  readonly port: number;
  readonly secure: boolean;
  readonly user: string;
  readonly pass: string;
  readonly from: string;
}

export function getSmtpConfig(env: EnvSource = process.env): SmtpConfig {
  const issues: ConfigIssue[] = [];
  const host = env.SMTP_HOST?.trim();
  const user = env.SMTP_USER?.trim();
  const pass = env.SMTP_PASS;
  const port = Number(env.SMTP_PORT);
  if (!host) issues.push({ variable: "SMTP_HOST", reason: "es obligatorio" });
  if (!user) issues.push({ variable: "SMTP_USER", reason: "es obligatorio" });
  if (!pass) issues.push({ variable: "SMTP_PASS", reason: "es obligatorio" });
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    issues.push({ variable: "SMTP_PORT", reason: "debe ser un puerto válido" });
  }
  if (issues.length) throw new ConfigurationError(issues);
  return {
    host: host as string,
    port,
    secure: env.SMTP_SECURE === "true",
    user: user as string,
    pass: pass as string,
    from: env.SMTP_FROM?.trim() || (user as string),
  };
}

export interface SapConfig {
  readonly baseUrl: string;
  readonly companyDb: string;
  readonly username: string;
  readonly password: string;
}

export function getSapConfig(env: EnvSource = process.env): SapConfig {
  const issues: ConfigIssue[] = [];
  const baseUrl = env.SAP_SERVICE_LAYER_URL?.trim();
  const companyDb = env.SAP_COMPANY_DB?.trim();
  const username = env.SAP_USER?.trim();
  const password = env.SAP_PASSWORD;
  if (!baseUrl) issues.push({ variable: "SAP_SERVICE_LAYER_URL", reason: "es obligatorio" });
  else if (!isHttpUrl(baseUrl)) issues.push({ variable: "SAP_SERVICE_LAYER_URL", reason: "debe ser una URL válida" });
  if (!companyDb) issues.push({ variable: "SAP_COMPANY_DB", reason: "es obligatorio" });
  if (!username) issues.push({ variable: "SAP_USER", reason: "es obligatorio" });
  if (!password) issues.push({ variable: "SAP_PASSWORD", reason: "es obligatorio" });
  if (issues.length) throw new ConfigurationError(issues);
  return { baseUrl: baseUrl as string, companyDb: companyDb as string, username: username as string, password: password as string };
}

export interface S3Config {
  readonly bucket: string;
  readonly region: string;
}

export function getAwsRegion(env: EnvSource = process.env): string {
  const region = env.AWS_DEFAULT_REGION?.trim() || env.AWS_REGION?.trim();
  if (!region) throw new ConfigurationError([{ variable: "AWS_DEFAULT_REGION", reason: "es obligatorio" }]);
  return region;
}

export function getS3Config(env: EnvSource = process.env): S3Config {
  const bucket = env.AWS_BUCKET?.trim();
  const region = env.AWS_DEFAULT_REGION?.trim() || env.AWS_REGION?.trim();
  const issues: ConfigIssue[] = [];
  if (!bucket) issues.push({ variable: "AWS_BUCKET", reason: "es obligatorio" });
  if (!region) issues.push({ variable: "AWS_DEFAULT_REGION", reason: "es obligatorio" });
  if (issues.length) throw new ConfigurationError(issues);
  return { bucket: bucket as string, region: region as string };
}

export function getApisNetPeToken(env: EnvSource = process.env): string {
  const token = env.APIS_NET_PE_TOKEN?.trim();
  if (!token) throw new ConfigurationError([{ variable: "APIS_NET_PE_TOKEN", reason: "es obligatorio" }]);
  return token;
}

export const DEFAULT_WHATSAPP_GRAPH_API_VERSION = "v26.0";

export interface WhatsAppConfig {
  readonly phoneNumberId: string;
  readonly accessToken: string;
  readonly graphApiVersion: string;
}

export function getWhatsAppConfig(env: EnvSource = process.env): WhatsAppConfig {
  const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const accessToken = env.WHATSAPP_ACCESS_TOKEN?.trim();
  const graphApiVersion = env.WHATSAPP_GRAPH_API_VERSION?.trim() || DEFAULT_WHATSAPP_GRAPH_API_VERSION;
  const issues: ConfigIssue[] = [];
  if (!phoneNumberId) issues.push({ variable: "WHATSAPP_PHONE_NUMBER_ID", reason: "es obligatorio" });
  if (!accessToken) issues.push({ variable: "WHATSAPP_ACCESS_TOKEN", reason: "es obligatorio" });
  if (!/^v\d+\.\d+$/.test(graphApiVersion)) {
    issues.push({ variable: "WHATSAPP_GRAPH_API_VERSION", reason: "debe tener el formato vN.N" });
  }
  if (issues.length) throw new ConfigurationError(issues);
  return { phoneNumberId: phoneNumberId as string, accessToken: accessToken as string, graphApiVersion };
}
