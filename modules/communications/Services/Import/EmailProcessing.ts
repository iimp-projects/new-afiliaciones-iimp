const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SEPARATOR_REGEX = /[;,]/;

/** Normaliza una dirección: recorta espacios externos y pasa a minúsculas. */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Divide una celda que puede contener varias direcciones separadas por
 * `;` o `,` y recorta cada una, descartando vacíos. Preserva mayúsculas/minúsculas;
 * la normalización a minúsculas se aplica después con normalizeEmail.
 */
export function splitEmails(value: string): string[] {
  return value
    .split(SEPARATOR_REGEX)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export function isValidEmail(value: string): boolean {
  return EMAIL_REGEX.test(value);
}

/** Elimina tildes/diacríticos para comparar encabezados de columna. */
export function removeAccents(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Normaliza un encabezado de columna para detección robusta. */
export function normalizeHeader(value: string): string {
  return removeAccents(value).trim().toUpperCase().replace(/\s+/g, " ");
}

/** Convierte el valor de una celda ExcelJS a texto seguro. */
export function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return String(value);
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if ("text" in record && typeof record.text === "string") return record.text;
    if ("result" in record && record.result != null) return String(record.result);
    if (Array.isArray(record.richText)) {
      return record.richText.map((item: unknown) => cellToString(item)).join("");
    }
    if (typeof record.hyperlink === "string") return record.hyperlink;
  }
  return "";
}
