/**
 * Arranque del servidor Next.js.
 *
 * Valida la configuración crítica en runtime del servidor. Se omite durante
 * `next build` (NEXT_PHASE === "phase-production-build") para que el artefacto
 * pueda construirse sin secretos reales, y en el runtime Edge para no cargar
 * módulos Node-only en el proxy.
 *
 * Si la configuración de producción es inválida, el proceso termina (exit 1)
 * para que el orquestador detecte el fallo en lugar de servir en estado roto.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
