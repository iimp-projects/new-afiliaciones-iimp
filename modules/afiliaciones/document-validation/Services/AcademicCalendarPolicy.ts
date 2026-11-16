export interface AcademicPeriod {
  readonly year: number;
  readonly term: 1 | 2;
}

export interface AcademicValidityPolicy {
  readonly currentPeriod: AcademicPeriod;
  readonly maxPreviousSemesters: number;
}

export type AcademicPeriodVerdict = "VALID" | "EXPIRED" | "FUTURE" | "UNKNOWN";

function normalizePeriodText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function termFromToken(token: string | undefined): 1 | 2 | null {
  if (!token) return null;
  if (/^(I|1|0?1|PRIMER|PRIMERO)$/.test(token)) return 1;
  if (/^(II|2|0?2|SEGUNDO)$/.test(token)) return 2;
  return null;
}

/**
 * Interpreta periodos como "2022-II", "2022-2", "2022 II" o
 * "Semestre Académico 2022-II". Un año sin semestre (por ejemplo "2022") no
 * permite acreditar vigencia y devuelve `null`.
 */
export function parseAcademicPeriod(value: string | null | undefined): AcademicPeriod | null {
  if (!value) return null;
  const text = normalizePeriodText(value);
  if (!text || /\bANUAL\b/.test(text)) return null;

  const yearMatch = /\b(19|20)\d{2}\b/.exec(text);
  if (!yearMatch) return null;
  const year = Number(yearMatch[0]);

  const afterYear = text.slice((yearMatch.index ?? 0) + yearMatch[0].length);
  const termMatch = afterYear.match(/(?:^|[\s\-/])(II|I|2|1)(?=$|[\s\-/.,;])/);
  const term = termFromToken(termMatch?.[1]);
  if (!term) return null;

  return { year, term };
}

/**
 * Calendario académico configurable. Sin override explícito, asume el
 * calendario peruano habitual: semestre I de marzo a julio y semestre II de
 * agosto a diciembre; enero-febrero conserva el semestre II del año anterior.
 * `DOCUMENT_AI_CURRENT_PERIOD` permite fijar el periodo institucional cuando
 * el calendario de una universidad difiere.
 */
function limaYearMonth(referenceDate: Date): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "numeric",
  }).formatToParts(referenceDate);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  return { year, month };
}

export function resolveCurrentAcademicPeriod(
  referenceDate: Date,
  override?: string | null,
): AcademicPeriod | null {
  const overridden = parseAcademicPeriod(override ?? null);
  if (overridden) return overridden;

  const { year, month } = limaYearMonth(referenceDate);
  if (month >= 3 && month <= 7) return { year, term: 1 };
  if (month >= 8 && month <= 12) return { year, term: 2 };
  return { year: year - 1, term: 2 };
}

export function academicPeriodIndex(period: AcademicPeriod): number {
  return period.year * 2 + (period.term - 1);
}

export function formatAcademicPeriod(period: AcademicPeriod): string {
  return `${period.year}-${period.term === 1 ? "I" : "II"}`;
}

export function evaluateAcademicPeriod(
  period: AcademicPeriod | null,
  policy: AcademicValidityPolicy,
): AcademicPeriodVerdict {
  if (!period) return "UNKNOWN";
  const difference = academicPeriodIndex(period) - academicPeriodIndex(policy.currentPeriod);
  if (difference === 0) return "VALID";
  if (difference > 0) return "FUTURE";
  if (difference >= -Math.max(0, policy.maxPreviousSemesters)) return "VALID";
  return "EXPIRED";
}
