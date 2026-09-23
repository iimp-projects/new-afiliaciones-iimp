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
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const { assertStartupConfig, ConfigurationError } = await import("./lib/config/env");
  try {
    assertStartupConfig();
  } catch (error) {
    if (error instanceof ConfigurationError) {
      console.error(`[startup] ${error.message}`);
      process.exit(1);
    }
    throw error;
  }
}
