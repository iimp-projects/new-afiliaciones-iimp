const MONTHS_ES_PE = ["ene.", "feb.", "mar.", "abr.", "may.", "jun.", "jul.", "ago.", "set.", "oct.", "nov.", "dic."] as const;

/**
 * Formatea una fecha como "d mmm. aaaa, h:mm a. m./p. m." de forma determinista.
 *
 * `Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short" })`
 * inserta un espacio de no-ruptura (U+00A0 / U+202F) en "a. m." / "p. m." que
 * difiere entre la ICU de Node y la del navegador, provocando errores de
 * hidratación en componentes cliente. Esta implementación no usa Intl y emplea
 * únicamente espacios regulares, de modo que servidor y cliente producen la
 * misma cadena.
 */
export function formatDateTimeEsPe(value: Date | string | null | undefined): string {
  if (value == null || value === "") return "No disponible";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "No disponible";

  const hours = date.getHours();
  const hour12 = hours % 12 || 12;
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const meridiem = hours < 12 ? "a. m." : "p. m.";

  return `${date.getDate()} ${MONTHS_ES_PE[date.getMonth()]} ${date.getFullYear()}, ${hour12}:${minutes} ${meridiem}`;
}
