/**
 * Clasificación de cuotas del SIE según el año calendario de Perú.
 *
 * Una cuota que el SIE reporta como `Pendiente` pero pertenece a un período
 * futuro no es una cuota exigible: se muestra como "próxima cuota a pagar".
 */

/** Año calendario vigente en Perú (America/Lima) para `reference`. */
export function currentQuotaYear(reference: Date = new Date()): number {
  const year = new Intl.DateTimeFormat("en-US", { timeZone: "America/Lima", year: "numeric" })
    .formatToParts(reference)
    .find((part) => part.type === "year")?.value;
  return Number(year);
}

/** `Pendiente` reportada por el SIE para un período futuro: próximo pago, no deuda. */
export function isUpcomingQuota(status: string, year: number, reference: Date = new Date()): boolean {
  return status === "PENDIENTE" && year > currentQuotaYear(reference);
}

/** `Pendiente` que sí cuenta como pendiente (período vigente o pasado). */
export function isCountedPending(status: string, year: number, reference: Date = new Date()): boolean {
  return status === "PENDIENTE" && !isUpcomingQuota(status, year, reference);
}
