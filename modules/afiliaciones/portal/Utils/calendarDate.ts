const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parts(value: string): [number, number, number] {
  const match = CALENDAR_DATE.exec(value);
  if (!match) throw new Error("La fecha debe tener el formato YYYY-MM-DD.");

  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error("La fecha de nacimiento no es válida.");
  }
  return [year, month, day];
}

/** Converts a calendar date to the Date required by Prisma's SQL DATE mapping. */
export function calendarDateToDatabaseDate(value: string | null): Date | null {
  if (value === null) return null;
  const [year, month, day] = parts(value);
  return new Date(Date.UTC(year, month - 1, day));
}

/** Serializes a Prisma SQL DATE without applying the server's local timezone. */
export function calendarDateFromDatabase(value: Date | null): string | null {
  if (!value) return null;
  return [value.getUTCFullYear(), String(value.getUTCMonth() + 1).padStart(2, "0"), String(value.getUTCDate()).padStart(2, "0")].join("-");
}

/** Formats an API calendar date without interpreting it in the browser's local timezone. */
export function formatCalendarDate(value: string | null, locale = "es-PE"): string | null {
  if (value === null) return null;
  const [year, month, day] = parts(value);
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, day)));
}
