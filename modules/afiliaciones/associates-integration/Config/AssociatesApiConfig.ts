export class AssociatesApiConfigurationError extends Error {
  constructor(message: string) { super(message); this.name = "AssociatesApiConfigurationError"; }
}

export type AssociatesApiConfig = { baseUrl: string; user: string; password: string; timeoutMs: number };

export function getAssociatesApiConfig(env: NodeJS.ProcessEnv = process.env): AssociatesApiConfig {
  const baseUrl = env.ASSOCIATES_API_BASE_URL?.trim();
  const user = env.ASSOCIATES_API_USER?.trim();
  const password = env.ASSOCIATES_API_PASSWORD;
  if (!baseUrl || !user || !password) throw new AssociatesApiConfigurationError("La integración de asociados no está configurada. Faltan variables privadas requeridas.");
  let normalizedBaseUrl: string;
  try { normalizedBaseUrl = new URL(baseUrl).toString().replace(/\/$/, ""); }
  catch { throw new AssociatesApiConfigurationError("ASSOCIATES_API_BASE_URL no es una URL válida."); }
  const configuredTimeout = Number(env.ASSOCIATES_API_TIMEOUT_MS ?? "10000");
  if (!Number.isInteger(configuredTimeout) || configuredTimeout < 1000 || configuredTimeout > 60000) throw new AssociatesApiConfigurationError("ASSOCIATES_API_TIMEOUT_MS debe estar entre 1000 y 60000.");
  return { baseUrl: normalizedBaseUrl, user, password, timeoutMs: configuredTimeout };
}
