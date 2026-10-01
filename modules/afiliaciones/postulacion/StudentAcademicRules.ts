/**
 * Reglas provisionales de catálogo académico para la modalidad ESTUDIANTE.
 *
 * Este módulo es puro (sin acceso a base de datos ni dependencias del servidor)
 * y puede importarse tanto desde el cliente como desde el servidor. Es la única
 * fuente de verdad de las restricciones de catálogo del flujo ESTUDIANTE para
 * evitar duplicar la lógica entre frontend y backend.
 *
 * IMPORTANTE — filtro de universidades PROVISIONAL:
 * `catalog_universities` mezcla actualmente universidades, institutos, escuelas
 * de posgrado y registros no educativos, y NO dispone de un discriminador
 * estable (UNIVERSITY / INSTITUTE / OTHER). El filtro `isLikelyUniversityName`
 * es una lista de exclusión basada en el nombre que NO debe considerarse
 * definitiva. Antes de producción se recomienda normalizar el catálogo y
 * sustituir este filtro por un campo de tipo en el modelo de institución.
 */

export const STUDENT_ALLOWED_SPECIALTY_CODES = [
  "ESP-MIN",
  "ESP-GEO",
  "ESP-MET",
] as const;

export type StudentAllowedSpecialtyCode =
  (typeof STUDENT_ALLOWED_SPECIALTY_CODES)[number];

/**
 * Indica si un código de especialidad es uno de los tres permitidos para la
 * modalidad ESTUDIANTE:
 *  - ESP-MIN -> Ingeniería de Minas
 *  - ESP-GEO -> Ingeniería Geológica
 *  - ESP-MET -> Ingeniería Metalúrgica
 */
export function isStudentAllowedSpecialtyCode(
  code: string | null | undefined,
): boolean {
  if (!code) return false;
  return (STUDENT_ALLOWED_SPECIALTY_CODES as readonly string[]).includes(code);
}

/**
 * Normaliza un nombre para comparación: elimina acentos/diacríticos (NFD) y
 * convierte a minúsculas, de modo que los patrones ASCII coincidan con nombres
 * acentuados como "COMPAÑÍA" o "INSTITUTO".
 */
function normalizeForMatch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Patrones de nombre que descartan una institución como "universidad" para el
 * flujo ESTUDIANTE. Lista de exclusión provisional (ver nota del módulo).
 * Se evalúan contra el nombre normalizado (sin acentos, en minúsculas).
 */
const NON_UNIVERSITY_NAME_PATTERNS: ReadonlyArray<RegExp> = [
  // Institutos y centros de educación superior técnica.
  /\binstituto\b/,
  /\biest\b/,
  /\biestp\b/,
  /\bistp\b/,
  /\bcetpro\b/,
  // Marcas / entidades técnicas específicas.
  /\bsenati\b/,
  /\btecsup\b/,
  /\bsencico\b/,
  /\bcibertec\b/,
  /\bisil\b/,
  /\bcertus\b/,
  /\bipae\b/,
  /\bidat\b/,
  /\bcenfotur\b/,
  // Escuelas de posgrado (no pregrado universitario).
  /\bescuela de posgrado\b/,
  // Registros evidentemente no educativos detectados en el catálogo.
  /\bcompania\b/,
  /centro de convenciones/,
  /^\s*e\d{4,}\b/,
  /^\s*test\s*$/,
];

/**
 * Determina si un nombre de institución corresponde (provisionalmente) a una
 * universidad. Devuelve `false` para nombres vacíos o que coincidan con los
 * patrones de exclusión definidos en {@link NON_UNIVERSITY_NAME_PATTERNS}.
 */
export function isLikelyUniversityName(
  name: string | null | undefined,
): boolean {
  if (!name) return false;
  const trimmed = name.trim();
  if (!trimmed) return false;
  const normalized = normalizeForMatch(trimmed);
  return !NON_UNIVERSITY_NAME_PATTERNS.some((pattern) => pattern.test(normalized));
}
