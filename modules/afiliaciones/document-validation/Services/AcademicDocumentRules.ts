import type { DocumentExtraction } from "../Models/DocumentExtraction";
import type {
  PrevalidationResultStatus,
  RuleCode,
  RuleEvaluationDTO,
  RuleStatus,
} from "../Models/DocumentPrevalidationDTO";
import {
  evaluateAcademicPeriod,
  formatAcademicPeriod,
  parseAcademicPeriod,
  type AcademicValidityPolicy,
} from "./AcademicCalendarPolicy";

export const ACADEMIC_DOCUMENT_RULES_VERSION = "1.0.0";

export interface ApplicantAcademicContext {
  readonly fullName: string | null;
  readonly universityName: string | null;
  readonly careerName: string | null;
  readonly declaredCycle: number | null;
}

export interface AcademicRuleInput {
  readonly extraction: DocumentExtraction;
  readonly applicant: ApplicantAcademicContext;
  readonly validityPolicy: AcademicValidityPolicy;
}

export interface AcademicRuleResult {
  readonly result: PrevalidationResultStatus;
  readonly rules: RuleEvaluationDTO[];
  readonly warnings: string[];
  readonly failedCodes: RuleCode[];
  readonly unknownCodes: RuleCode[];
  readonly securityWarning: boolean;
}

const RULE_LABELS: Readonly<Record<RuleCode, string>> = {
  R01: "Tipo de documento",
  R02: "Identidad del estudiante",
  R03: "Universidad",
  R04: "Carrera profesional",
  R05: "Ciclo académico",
  R06: "Vigencia académica",
  R07: "Autoridad y firma",
  R08: "Legibilidad e integridad",
};

const PROMPT_INJECTION_PATTERNS: ReadonlyArray<RegExp> = [
  /ignora(?:r)?\s+(?:las\s+)?instrucciones/i,
  /ignore\s+(?:all\s+)?previous/i,
  /system\s*prompt/i,
  /prompt\s+del\s+sistema/i,
  /aprueba\s+(?:esta|la)\s+(?:solicitud|afiliaci[oó]n)/i,
  /no\s+eval[uú]es/i,
  /act[uú]a\s+como/i,
  /devuelve\s+.*(?:aprobado|prevalidado)/i,
  /omite\s+(?:las\s+)?reglas/i,
];

const COMPLETENESS_WARNING_PATTERNS: ReadonlyArray<RegExp> = [
  /ilegible/i,
  /recort/i,
  /incomplet/i,
  /falta(?:n)?\s+p[aá]gina/i,
  /no\s+se\s+(?:visualiza|aprecia|observa)\s+(?:la|el|una|un)\s+(?:p[aá]gina|texto|documento|contenido)/i,
  /borros/i,
];

function normalizeComparable(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokens(value: string | null | undefined): string[] {
  const normalized = normalizeComparable(value);
  return normalized ? normalized.split(" ").filter(Boolean) : [];
}

function sameTokenSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  return leftSet.size === rightSet.size && [...leftSet].every((token) => rightSet.has(token));
}

function containsAll(haystack: string[], needle: string[]): boolean {
  if (!needle.length || needle.length >= haystack.length) return false;
  const set = new Set(haystack);
  return needle.every((token) => set.has(token));
}

function isCompleteAndLegible(extraction: DocumentExtraction): boolean {
  return extraction.documento_completo === true && extraction.legibilidad !== "ilegible";
}

function parseCycle(value: string | null): number | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  // Un periodo académico (p. ej. "2022-II") no es un ciclo y no debe derivarse
  // a partir de él.
  if (/\b(19|20)\d{2}\b/.test(normalized)) return null;
  const arabic = normalized.match(/(?:^|\b)(?:CICLO\s*)?(\d{1,2})(?:\s*(?:ER|DO|TO|MO|VO|NO|SIMO)?\s*(?:CICLO)?)?$/);
  if (arabic) {
    const parsed = Number(arabic[1]);
    return parsed >= 1 && parsed <= 12 ? parsed : null;
  }
  const romanMap: Readonly<Record<string, number>> = {
    I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10, XI: 11, XII: 12,
  };
  const roman = normalized.match(/(?:CICLO\s*)?(XII|XI|X|IX|VIII|VII|VI|V|IV|III|II|I)(?:\s*CICLO)?$/);
  return roman ? romanMap[roman[1]] ?? null : null;
}

const GENERIC_UNIVERSITY_TOKENS = new Set([
  "universidad", "nacional", "facultad", "escuela", "profesional", "del", "de", "la", "las", "los", "el", "y",
]);

const UNIVERSITY_CONNECTORS = new Set(["del", "de", "la", "las", "los", "el", "y"]);

function universityAcronym(value: string | null | undefined): string {
  return tokens(value)
    .filter((token) => !UNIVERSITY_CONNECTORS.has(token))
    .map((token) => token[0])
    .join("");
}

function distinctiveTokens(value: string | null | undefined): string[] {
  return tokens(value).filter((token) => token.length >= 4 && !GENERIC_UNIVERSITY_TOKENS.has(token));
}

type Compatibility = "MATCH" | "MISMATCH" | "UNKNOWN";

function compareUniversity(extracted: string | null, declared: string | null): Compatibility {
  if (!extracted || !declared) return "UNKNOWN";
  const left = normalizeComparable(extracted);
  const right = normalizeComparable(declared);
  if (!left || !right) return "UNKNOWN";
  if (left === right || left.includes(right) || right.includes(left)) return "MATCH";

  const extractedCompact = left.replace(/ /g, "");
  const declaredCompact = right.replace(/ /g, "");
  const declaredAcronym = universityAcronym(declared);
  const extractedAcronym = universityAcronym(extracted);
  if (declaredAcronym.length >= 3 && extractedCompact === declaredAcronym) return "MATCH";
  if (extractedAcronym.length >= 3 && declaredCompact === extractedAcronym) return "MATCH";
  if (extractedAcronym.length >= 3 && extractedAcronym === declaredAcronym) return "MATCH";

  const leftDistinctive = distinctiveTokens(extracted);
  const rightDistinctive = distinctiveTokens(declared);
  if (!leftDistinctive.length || !rightDistinctive.length) return "UNKNOWN";
  const rightSet = new Set(rightDistinctive);
  const shared = leftDistinctive.filter((token) => rightSet.has(token));
  if (shared.length >= Math.min(2, Math.min(leftDistinctive.length, rightDistinctive.length))) return "MATCH";
  return "MISMATCH";
}

type CareerFamily = "minas" | "geologia" | "metalurgia";

function careerFamily(value: string | null | undefined): CareerFamily | null {
  const normalized = normalizeComparable(value);
  if (!normalized) return null;
  if (/\b(minas|mineria|minera|minero)\b/.test(normalized)) return "minas";
  if (/\b(geologia|geologica|geologico)\b/.test(normalized)) return "geologia";
  if (/\b(metalurgia|metalurgica|metalurgico)\b/.test(normalized)) return "metalurgia";
  return null;
}

function compareCareer(extracted: string | null, declared: string | null): Compatibility {
  if (!extracted || !declared) return "UNKNOWN";
  const left = normalizeComparable(extracted);
  const right = normalizeComparable(declared);
  if (!left || !right) return "UNKNOWN";
  if (left === right || left.includes(right) || right.includes(left)) return "MATCH";

  const extractedFamily = careerFamily(extracted);
  const declaredFamily = careerFamily(declared);
  if (extractedFamily && declaredFamily) return extractedFamily === declaredFamily ? "MATCH" : "MISMATCH";
  return "MISMATCH";
}

function containsInjectionSignal(extraction: DocumentExtraction): boolean {
  const candidates = [
    extraction.nombre_completo,
    extraction.universidad,
    extraction.carrera,
    extraction.ciclo_academico,
    extraction.periodo_academico,
    extraction.fecha_emision,
    extraction.autoridad_emisora,
    ...extraction.advertencias,
  ].filter((value): value is string => typeof value === "string");
  return candidates.some((value) => PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(value)));
}

function hasCompletenessWarning(extraction: DocumentExtraction): boolean {
  return extraction.advertencias.some((warning) =>
    COMPLETENESS_WARNING_PATTERNS.some((pattern) => pattern.test(warning)),
  );
}

function rule(
  code: RuleCode,
  status: RuleStatus,
  message: string,
  evidence?: string,
): RuleEvaluationDTO {
  return {
    code,
    label: RULE_LABELS[code],
    status,
    message,
    ...(evidence ? { evidence } : {}),
  };
}

function evaluateR01(extraction: DocumentExtraction): RuleEvaluationDTO {
  switch (extraction.tipo_documento) {
    case "constancia_estudios":
      return rule("R01", "PASS", "El documento se identifica como constancia de estudios.");
    case "constancia_matricula":
      return rule("R01", "FAIL", "El documento corresponde a una constancia de matrícula. El IIMP no la acepta en reemplazo de una constancia de estudios.");
    case "ficha_matricula":
      return rule("R01", "FAIL", "El documento corresponde a una ficha de matrícula. El IIMP no la acepta en reemplazo de una constancia de estudios.");
    case "carnet_universitario":
      return rule("R01", "FAIL", "El documento corresponde a un carné universitario, no a una constancia de estudios.");
    case "documento_identidad":
      return rule("R01", "FAIL", "El documento corresponde a un documento de identidad, no a una constancia de estudios.");
    case "otro":
      return rule("R01", "UNKNOWN", "El documento no se identifica como constancia de estudios y requiere revisión administrativa.");
    default:
      return rule("R01", "UNKNOWN", "No fue posible identificar el tipo de documento.");
  }
}

function evaluateR02(extraction: DocumentExtraction, applicant: ApplicantAcademicContext): RuleEvaluationDTO {
  const extracted = extraction.nombre_completo;
  if (!extracted) {
    return rule("R02", "UNKNOWN", "No se identifica el nombre completo del estudiante en el documento.");
  }
  if (!applicant.fullName) {
    return rule("R02", "UNKNOWN", "No se pudo comparar el nombre con los datos del expediente.");
  }

  const extractedTokens = tokens(extracted);
  const applicantTokens = tokens(applicant.fullName);

  if (sameTokenSet(extractedTokens, applicantTokens)) {
    return rule("R02", "PASS", "El nombre del documento coincide con el registrado en el expediente.");
  }
  if (containsAll(extractedTokens, applicantTokens) || containsAll(applicantTokens, extractedTokens)) {
    return rule("R02", "UNKNOWN", "El nombre coincide parcialmente con el registrado; requiere revisión.");
  }
  return rule("R02", "FAIL", "El nombre del documento no coincide con el nombre registrado en el expediente.");
}

function evaluateR03(extraction: DocumentExtraction, applicant: ApplicantAcademicContext): RuleEvaluationDTO {
  const university = extraction.universidad;
  if (!university) {
    return rule("R03", "UNKNOWN", "No se identifica la universidad en el documento.");
  }
  if (!applicant.universityName) {
    return rule("R03", "PASS", "La universidad está identificada en el documento.", university);
  }
  const compatibility = compareUniversity(university, applicant.universityName);
  if (compatibility === "MATCH") {
    return rule("R03", "PASS", "La universidad identificada coincide con la registrada en el expediente.", university);
  }
  if (compatibility === "MISMATCH") {
    return rule("R03", "UNKNOWN", "La universidad identificada no coincide exactamente con la registrada en el expediente.", university);
  }
  return rule("R03", "PASS", "La universidad está identificada; no fue posible compararla automáticamente.", university);
}

function evaluateR04(
  extraction: DocumentExtraction,
  applicant: ApplicantAcademicContext,
  complete: boolean,
): RuleEvaluationDTO {
  const career = extraction.carrera;
  if (!career) {
    return complete
      ? rule("R04", "FAIL", "No se identifica la carrera profesional en la constancia.")
      : rule("R04", "UNKNOWN", "No se identifica la carrera profesional; el documento parece incompleto.");
  }
  if (!applicant.careerName) {
    return rule("R04", "PASS", "La carrera profesional está identificada en el documento.", career);
  }
  const compatibility = compareCareer(career, applicant.careerName);
  if (compatibility === "MATCH") {
    return rule("R04", "PASS", "La carrera profesional coincide con la declarada en el expediente.", career);
  }
  if (compatibility === "MISMATCH") {
    return rule("R04", "FAIL", "La carrera indicada en el documento no coincide con la declarada en el expediente.", career);
  }
  return rule("R04", "UNKNOWN", "No fue posible comparar la carrera del documento con la declarada.", career);
}

function evaluateR05(
  extraction: DocumentExtraction,
  applicant: ApplicantAcademicContext,
  complete: boolean,
): RuleEvaluationDTO {
  const rawCycle = extraction.ciclo_academico;
  if (!rawCycle) {
    return complete
      ? rule("R05", "FAIL", "No se identifica el ciclo académico actual. El periodo académico no reemplaza este requisito.")
      : rule("R05", "UNKNOWN", "No se identifica el ciclo académico; la imagen puede estar incompleta.");
  }

  const cycle = parseCycle(rawCycle);
  if (cycle === null) {
    return rule("R05", "UNKNOWN", "No se pudo interpretar el ciclo académico indicado en el documento.", rawCycle);
  }
  if (applicant.declaredCycle !== null && applicant.declaredCycle !== cycle) {
    return rule(
      "R05",
      "UNKNOWN",
      `El ciclo indicado en el documento (${cycle}) difiere del declarado en el expediente (${applicant.declaredCycle}).`,
      rawCycle,
    );
  }
  return rule("R05", "PASS", `Se identifica el ciclo académico actual: ${cycle}.`, String(cycle));
}

function evaluateR06(
  extraction: DocumentExtraction,
  policy: AcademicValidityPolicy,
  complete: boolean,
): RuleEvaluationDTO {
  const rawPeriod = extraction.periodo_academico;
  if (!rawPeriod) {
    return complete
      ? rule("R06", "FAIL", "No se identifica el periodo académico que acredite vigencia.")
      : rule("R06", "UNKNOWN", "No se identifica el periodo académico; la imagen puede estar incompleta.");
  }

  const period = parseAcademicPeriod(rawPeriod);
  if (!period) {
    return rule("R06", "UNKNOWN", "No se pudo interpretar el periodo académico indicado.", rawPeriod);
  }

  const verdict = evaluateAcademicPeriod(period, policy);
  const current = formatAcademicPeriod(policy.currentPeriod);
  if (verdict === "VALID") {
    return rule("R06", "PASS", `El periodo ${formatAcademicPeriod(period)} acredita vigencia frente al periodo actual ${current}.`, formatAcademicPeriod(period));
  }
  if (verdict === "EXPIRED") {
    return rule(
      "R06",
      "FAIL",
      `El documento corresponde al periodo académico ${formatAcademicPeriod(period)}, que no está vigente. Se requiere una constancia del periodo actual.`,
      formatAcademicPeriod(period),
    );
  }
  return rule("R06", "UNKNOWN", `El periodo ${formatAcademicPeriod(period)} es posterior al periodo de referencia ${current}.`, formatAcademicPeriod(period));
}

function evaluateR07(extraction: DocumentExtraction, complete: boolean): RuleEvaluationDTO {
  const authority = extraction.autoridad_emisora;
  const signature = extraction.firma_visible;

  if (!complete) {
    if (signature !== true || !authority) {
      return rule("R07", "UNKNOWN", "No se puede verificar la firma o la autoridad emisora en la imagen parcial.");
    }
  }
  if (signature === false) {
    return rule("R07", "FAIL", "No se observa evidencia visible de firma de la autoridad académica.");
  }
  if (!authority) {
    return complete
      ? rule("R07", "FAIL", "No se identifica la autoridad académica emisora de la constancia.")
      : rule("R07", "UNKNOWN", "No se identifica la autoridad emisora; la imagen puede estar incompleta.");
  }
  if (signature === null) {
    return rule("R07", "UNKNOWN", "No se pudo verificar la presencia visible de firma en el documento.");
  }
  return rule(
    "R07",
    "PASS",
    "Se identifica una autoridad emisora y evidencia visible de firma. Esto no certifica la autenticidad del documento.",
    authority,
  );
}

function evaluateR08(extraction: DocumentExtraction, securityWarning: boolean): RuleEvaluationDTO {
  if (securityWarning) {
    return rule("R08", "UNKNOWN", "El documento contiene instrucciones dirigidas a un sistema automatizado y requiere revisión administrativa.");
  }
  if (extraction.legibilidad === "ilegible") {
    return rule("R08", "FAIL", "El documento no es legible.");
  }
  if (extraction.legibilidad === "parcial") {
    return rule("R08", "UNKNOWN", "El documento es parcialmente legible.");
  }
  if (extraction.documento_completo === false || hasCompletenessWarning(extraction)) {
    return rule("R08", "UNKNOWN", "El documento parece incompleto o recortado.");
  }
  if (extraction.documento_completo === null) {
    return rule("R08", "UNKNOWN", "No se pudo confirmar que todas las páginas relevantes estén disponibles.");
  }
  return rule("R08", "PASS", "El documento es legible y está completo.");
}

/**
 * Motor determinista de requisitos académicos. El modelo solo aporta datos
 * extraídos; este motor decide PASS/FAIL/UNKNOWN y el resultado global.
 */
export function evaluateAcademicDocument(input: AcademicRuleInput): AcademicRuleResult {
  const { extraction, applicant, validityPolicy } = input;
  const complete = isCompleteAndLegible(extraction);
  const securityWarning = containsInjectionSignal(extraction);

  const rules: RuleEvaluationDTO[] = [
    evaluateR01(extraction),
    evaluateR02(extraction, applicant),
    evaluateR03(extraction, applicant),
    evaluateR04(extraction, applicant, complete),
    evaluateR05(extraction, applicant, complete),
    evaluateR06(extraction, validityPolicy, complete),
    evaluateR07(extraction, complete),
    evaluateR08(extraction, securityWarning),
  ];

  const warnings = new Set<string>();
  for (const warning of extraction.advertencias) {
    if (warning.trim()) warnings.add(warning.trim());
  }
  if (securityWarning) {
    warnings.add("El documento contiene instrucciones dirigidas a un sistema automatizado.");
  }
  for (const item of rules) {
    if (item.status === "UNKNOWN" && item.code !== "R08") warnings.add(item.message);
  }

  const failedCodes = rules.filter((item) => item.status === "FAIL").map((item) => item.code);
  const unknownCodes = rules.filter((item) => item.status === "UNKNOWN").map((item) => item.code);

  let result: PrevalidationResultStatus;
  if (securityWarning) result = "NEEDS_REVIEW";
  else if (failedCodes.length > 0) result = "OBSERVED";
  else if (unknownCodes.length > 0) result = "NEEDS_REVIEW";
  else result = "PREVALIDATED";

  return {
    result,
    rules,
    warnings: [...warnings].slice(0, 20),
    failedCodes,
    unknownCodes,
    securityWarning,
  };
}
