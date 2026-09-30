export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

/**
 * Valida el archivo de importación (.xlsx, tamaño <= 5 MB, firma ZIP). No
 * confía en el MIME del cliente. Devuelve null si es válido o el mensaje de error.
 */
export function validateRecipientFile(name: string, size: number, isZip: boolean): string | null {
  if (!name.toLowerCase().endsWith(".xlsx")) return "El archivo debe tener extensión .xlsx.";
  if (size <= 0) return "El archivo está vacío.";
  if (size > MAX_FILE_SIZE_BYTES) return "El archivo supera el tamaño máximo de 5 MB.";
  if (!isZip) return "El archivo no es un XLSX válido.";
  return null;
}
