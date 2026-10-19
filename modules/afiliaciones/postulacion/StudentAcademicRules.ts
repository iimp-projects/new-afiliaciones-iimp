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
 * Códigos históricos equivalentes a las familias admitidas para Estudiante.
 *
 * La consolidación legacy dejó variantes de catálogo (p. ej. "Geología") con
 * `code` propio o nulo. Estos códigos amplían la lista canónica SOLO para
 * postulaciones migradas, nunca para postulaciones nuevas.
 */
export const LEGACY_STUDENT_SPECIALTY_CODES = [
  "ESP-MIN",
  "ESP-GEO",
  "ESP-MET",
  "ESP-GEOL",
] as const;

/**
 * Identifica una postulación migrada del sistema Legacy.
 *
 * El mecanismo real de identificación es el `trackingCode`: las postulaciones
 * nuevas se generan con `randomUUID()` (StartApplicationService), mientras que
 * las migradas usan el prefijo determinista `LEGACY-{fichnro}`
 * (`resolveTrackingCode`). No se infiere por el `applicationCode`.
 */
export function isLegacyTrackingCode(
  trackingCode: string | null | undefined,
): boolean {
  return typeof trackingCode === "string" && trackingCode.startsWith("LEGACY-");
}

/**
 * Normaliza el nombre de una especialidad para comparación estructural:
 * minúsculas, sin tildes (reutiliza {@link normalizeForMatch}) y con los
 * signos de puntuación, guiones y separadores convertidos a espacios simples.
 * El resultado es una secuencia de tokens alfanuméricos separados por espacios.
 */
function normalizeSpecialtyForMatch(value: string): string {
  return normalizeForMatch(value)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Raíces terminológicas (normalizadas, con límite de palabra) que identifican
 * el núcleo de cada una de las tres familias admitidas para Estudiante:
 *
 *  - Minas → "Ingeniería de Minas", "Ingeniería Minera", "Minería".
 *  - Geología → "Geología", "Ingeniería Geológica", "Geología Aplicada".
 *  - Metalurgia → "Metalurgia", "Ingeniería Metalúrgica", "Metalurgia Extractiva".
 *
 * Son raíces de la carrera núcleo, no subcadenas genéricas: no se acepta
 * cualquier nombre que simplemente contenga "minas"/"geología"/"metalurgia"
 * como modificador (eso se descarta en {@link LEGACY_UNRELATED_CAREER_ROOTS}).
 */
const LEGACY_STUDENT_SPECIALTY_FAMILY_ROOTS: ReadonlyArray<RegExp> = [
  // Minas
  /\bminas\b/,
  /\bmineria\b/,
  /\bminera\b/,
  /\bminero\b/,
  // Geología
  /\bgeologia\b/,
  /\bgeologica\b/,
  /\bgeologico\b/,
  // Metalurgia
  /\bmetalurgia\b/,
  /\bmetalurgica\b/,
  /\bmetalurgico\b/,
];

/**
 * Raíces de carreras principales NO relacionadas con las familias admitidas.
 *
 * Si el nombre de la especialidad contiene una de estas raíces además de una
 * raíz de familia, se considera una coincidencia ambigua (la carrera principal
 * es otra y "minas"/"geología"/"metalurgia" actúa solo como contexto o mención,
 * p. ej. "Ingeniería Civil en Metalurgia" o "Derecho Minero") y se rechaza.
 *
 * La lista se deriva del catálogo de especialidades del sistema y de carreras
 * frecuentemente confundidas (hidrocarburos, alimentos, textil, etc.).
 */
const LEGACY_UNRELATED_CAREER_ROOTS: ReadonlyArray<RegExp> = [
  /\bcivil\b/,
  /\bindustrial\b/,
  /\bmecanica\b/,
  /\bmecanico\b/,
  /\belectrica\b/,
  /\belectrico\b/,
  /\belectronica\b/,
  /\belectronico\b/,
  /\bmecatronica\b/,
  /\bquimica\b/,
  /\bquimico\b/,
  /\bsistemas\b/,
  /\bsoftware\b/,
  /\binformatica\b/,
  /\binformatico\b/,
  /\btelecomunicaciones\b/,
  /\btelecomunicacion\b/,
  /\bagronoma\b/,
  /\bagronomo\b/,
  /\bagricola\b/,
  /\bambiental\b/,
  /\bsanitaria\b/,
  /\bsanitario\b/,
  /\bseguridad\b/,
  /\bhigiene\b/,
  /\badministracion\b/,
  /\beconomia\b/,
  /\bcontabilidad\b/,
  /\bfinanzas\b/,
  /\bnegocios\b/,
  /\bhumanos\b/,
  /\bderecho\b/,
  /\beducacion\b/,
  /\bcomunicacion\b/,
  /\bcomunicaciones\b/,
  /\bsociologia\b/,
  /\bmedicina\b/,
  /\bpsicologia\b/,
  /\barquitectura\b/,
  /\bpetroleo\b/,
  /\bpetroquimica\b/,
  /\bhidrocarburos\b/,
  /\btextil\b/,
  /\balimentos\b/,
  /\bpesquera\b/,
  /\bpesqueria\b/,
  /\bforestal\b/,
];

/**
 * Indica si una especialidad histórica (por `code` o por `name`) pertenece a
 * una de las familias admitidas para Estudiante en postulaciones Legacy.
 *
 * La validación por nombre exige:
 *  1. Presencia de una raíz de familia como carrera núcleo.
 *  2. Ausencia de una raíz de carrera principal no relacionada (ambigüedad).
 *
 * Se usa exclusivamente en la subsanación de postulaciones migradas; las
 * postulaciones nuevas siguen restringidas a {@link STUDENT_ALLOWED_SPECIALTY_CODES}.
 */
export function isLegacyStudentAllowedSpecialty(
  code: string | null | undefined,
  name: string | null | undefined,
): boolean {
  if (code && (LEGACY_STUDENT_SPECIALTY_CODES as readonly string[]).includes(code)) {
    return true;
  }
  const normalized = name ? normalizeSpecialtyForMatch(name) : "";
  if (!normalized) return false;

  const hasFamilyRoot = LEGACY_STUDENT_SPECIALTY_FAMILY_ROOTS.some((pattern) =>
    pattern.test(normalized),
  );
  if (!hasFamilyRoot) return false;

  const hasUnrelatedCareer = LEGACY_UNRELATED_CAREER_ROOTS.some((pattern) =>
    pattern.test(normalized),
  );
  return !hasUnrelatedCareer;
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
