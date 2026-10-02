import { prisma } from "@/lib/prisma";
import { operationalAlertTrackingService } from "@/modules/afiliaciones/alerts/Services/OperationalAlertTrackingService";

/**
 * Punto de entrada one-shot del scheduler de alertas operativas.
 *
 * Reutiliza exclusivamente OperationalAlertTrackingService.synchronize()
 * (que a su vez llama a OperationalAlertsService.detectAll()). No duplica
 * reglas de detección ni usa el endpoint HTTP.
 *
 * El proceso termina con exit code 0 en éxito y != 0 ante excepción, y cierra
 * la conexión de Prisma para que el contenedor one-shot finalice naturalmente.
 */

export function sanitizeError(error: unknown): string {
  const name = error instanceof Error ? error.name : "UnknownError";
  const message = error instanceof Error ? error.message : String(error);
  // Redacción defensiva: nunca exponer DATABASE_URL, contraseñas ni correos.
  const redacted = message
    .replace(/postgres(ql)?:\/\/[^:@/\s]+:[^@\s]+@/gi, "postgresql://[REDACTED]@")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[EMAIL_REDACTED]");
  return `${name}: ${redacted}`;
}

export async function runSynchronize(): Promise<number> {
  const startedAt = Date.now();
  console.info("[OPERATIONAL_ALERTS_SYNC] start");
  try {
    const result = await operationalAlertTrackingService.synchronize();
    console.info("[OPERATIONAL_ALERTS_SYNC] result", JSON.stringify(result));
    return 0;
  } catch (error) {
    console.error("[OPERATIONAL_ALERTS_SYNC] failed", {
      error: sanitizeError(error),
      durationMs: Date.now() - startedAt,
    });
    return 1;
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

// Ejecuta solo cuando este archivo es el entrypoint real del proceso
// (no al importarse desde tests).
if (process.argv[1] && process.argv[1].includes("synchronize-alerts")) {
  void runSynchronize().then((code) => {
    process.exitCode = code;
  });
}
