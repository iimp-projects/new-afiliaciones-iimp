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
