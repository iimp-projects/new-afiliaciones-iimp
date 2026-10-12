/**
 * Configuración interna del motor de envío masivo de correos.
 *
 * Valores conservadores y centralizados para controlar trazabilidad y evitar
 * bloqueos del proveedor SMTP. No son límites del proveedor (aún no conocidos):
 * son parámetros ajustables sin tocar el resto del código.
 */

/** Número de destinatarios procesados por cada invocación de lote. */
export const CAMPAIGN_BATCH_SIZE = 10;

/** Concurrencia de envíos SMTP dentro de un lote (1 = secuencial). */
export const CAMPAIGN_SEND_CONCURRENCY = 1;

/** Minutos sin actividad de lote tras los cuales una campaña SENDING se considera interrumpida. */
export const CAMPAIGN_STALE_TIMEOUT_MINUTES = 15;

/** Intervalo de polling (ms) del cliente mientras la campaña está en SENDING. */
export const CAMPAIGN_POLL_INTERVAL_MS = 3000;

/** Espera por defecto tras un límite temporal (rate-limit) del proveedor. */
export const CAMPAIGN_RATE_LIMIT_COOLDOWN_MS = 15 * 60 * 1000;

/**
 * Límite temporal (rate-limit) configurable. `CAMPAIGN_RATE_LIMIT_COOLDOWN_MS`
 * en milisegundos; si no se define o es inválido usa el valor por defecto.
 */
export function getCampaignRateLimitCooldownMs(): number {
  const value = Number(process.env.CAMPAIGN_RATE_LIMIT_COOLDOWN_MS);
  return Number.isFinite(value) && value > 0 ? value : CAMPAIGN_RATE_LIMIT_COOLDOWN_MS;
}

/**
 * Cuota diaria configurable de envíos. `CAMPAIGN_DAILY_QUOTA_LIMIT` (número
 * entero). `0` o ausente desactiva el tope local (solo reacciona al proveedor).
 * No asume un límite de proveedor concreto.
 */
export function getCampaignDailyQuotaLimit(): number {
  const value = Number(process.env.CAMPAIGN_DAILY_QUOTA_LIMIT);
  return Number.isInteger(value) && value > 0 ? value : 0;
}

/** Inicio del día actual (UTC) usado para el contador de envíos diarios. */
export function startOfUtcDay(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Inicio del día siguiente (UTC), usado como punto de reanudación de la cuota diaria. */
export function nextUtcDayStart(now: Date = new Date()): Date {
  const start = startOfUtcDay(now);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}
