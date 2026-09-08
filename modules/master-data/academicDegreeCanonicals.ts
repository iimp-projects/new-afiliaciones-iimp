/** Approved catalog entries exposed to functional degree selectors. */
export const APPROVED_ACADEMIC_DEGREE_IDS: readonly number[] = [] as const;
export const APPROVED_ACADEMIC_DEGREE_CODES = [
  "BACH", "TIT", "LIC", "ING",   // Pregrado
  "MAG", "MBA",                   // Maestría
  "DOC", "POST",                  // Doctorado
  "ESP", "DIP",                   // Otros
] as const;
