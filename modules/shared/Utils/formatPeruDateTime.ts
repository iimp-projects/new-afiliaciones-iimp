/**
 * Zona horaria institucional para presentación de fechas/horas a usuarios en Perú.
 * No usar offsets manuales (UTC-5) ni el timezone implícito del runtime.
 */
export const LIMA_TIME_ZONE = "America/Lima";

function toDate(value: Date | string): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function partValue(date: Date, type: Intl.DateTimeFormatPartTypes, options: Intl.DateTimeFormatOptions): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: LIMA_TIME_ZONE, ...options }).formatToParts(date);
  return parts.find((part) => part.type === type)?.value ?? "";
}

/**
 * Formatea la fecha en zona Lima como DD/MM/YYYY (p. ej. 30/09/2026).
 */
export function formatPeruDate(value: Date | string): string {
  const date = toDate(value);
  if (!date) return "No disponible";

  const day = partValue(date, "day", { day: "2-digit", month: "2-digit", year: "numeric" });
  const month = partValue(date, "month", { day: "2-digit", month: "2-digit", year: "numeric" });
  const year = partValue(date, "year", { day: "2-digit", month: "2-digit", year: "numeric" });
  return `${day}/${month}/${year}`;
}

/**
 * Formatea la hora en zona Lima como hh:mm a. m./p. m. (p. ej. 09:49 a. m.).
 */
export function formatPeruTime(value: Date | string): string {
  const date = toDate(value);
  if (!date) return "No disponible";

  const hour = partValue(date, "hour", { hour: "2-digit", minute: "2-digit", hour12: true });
  const minute = partValue(date, "minute", { hour: "2-digit", minute: "2-digit", hour12: true });
  const dayPeriod = partValue(date, "dayPeriod", { hour: "2-digit", minute: "2-digit", hour12: true });
  const meridiem = dayPeriod.toLowerCase() === "pm" ? "p. m." : "a. m.";
  return `${hour}:${minute} ${meridiem}`;
}

/**
 * Formatea fecha y hora en zona Lima como DD/MM/YYYY hh:mm a. m./p. m.
 */
export function formatPeruDateTime(value: Date | string): string {
  const date = toDate(value);
  if (!date) return "No disponible";
  return `${formatPeruDate(date)} ${formatPeruTime(date)}`;
}

/**
 * Formatea una fecha de calendario (DATE-only, p. ej. fecha de nacimiento)
 * como DD/MM/YYYY SIN aplicar conversión de zona horaria, de modo que no se
 * desplace el día. Acepta "YYYY-MM-DD", un ISO timestamp o un Date.
 */
export function formatCalendarDate(value: Date | string | null | undefined): string {
  if (value == null || value === "") return "No disponible";

  let year: number;
  let month: number;
  let day: number;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "No disponible";
    year = value.getUTCFullYear();
    month = value.getUTCMonth() + 1;
    day = value.getUTCDate();
  } else {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
    if (!match) return value.trim();
    year = Number(match[1]);
    month = Number(match[2]);
    day = Number(match[3]);
  }

  const pad = (part: number): string => String(part).padStart(2, "0");
  return `${pad(day)}/${pad(month)}/${year}`;
}
