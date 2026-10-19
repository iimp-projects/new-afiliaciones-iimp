/**
 * Reconciliación estricta de identidades SIE (documento + multiconjunto de nombres).
 *
 * Reglas (sin fuzzy matching):
 * - Documento: tipo (mapeado) + número, preservando ceros iniciales.
 * - Nombres: normalización (minúsculas, sin tildes, sin puntuación, colapso de espacios).
 * - Comparación de TODOS los componentes del nombre, independientemente del orden
 *   y de su distribución entre nombres/apellidos.
 * - Componentes repetidos mediante multiconjuntos.
 * - SAFE_MATCH solo si: documento coincide, existe UNA persona candidata,
 *   todos los componentes coinciden como multiconjunto y no hay contradicciones.
 */

export type NamePart = {
  nombres: string | null;
  apellidoPaterno: string | null;
  apellidoMaterno: string | null;
};

export type PersonNamePart = {
  firstName: string;
  paternalLastName: string;
  maternalLastName: string | null;
};

export function normalizeNameComponent(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Tokeniza y normaliza un nombre completo en sus componentes (multiconjunto). */
export function tokenizeName(parts: NamePart): string[] {
  return [parts.nombres, parts.apellidoPaterno, parts.apellidoMaterno]
    .filter((v): v is string => Boolean(v))
    .join(" ")
    .split(/\s+/)
    .map(normalizeNameComponent)
    .filter(Boolean);
}

export function tokenizePersonName(parts: PersonNamePart): string[] {
  return [parts.firstName, parts.paternalLastName, parts.maternalLastName]
    .filter((v): v is string => Boolean(v))
    .join(" ")
    .split(/\s+/)
    .map(normalizeNameComponent)
    .filter(Boolean);
}

function toMultiset(tokens: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tokens) m.set(t, (m.get(t) ?? 0) + 1);
  return m;
}

export function areNameMultisetsEqual(sie: NamePart, person: PersonNamePart): boolean {
  const a = tokenizeName(sie);
  const b = tokenizePersonName(person);
  if (a.length === 0 || b.length === 0) return false;
  if (a.length !== b.length) return false;
  const ma = toMultiset(a);
  const mb = toMultiset(b);
  for (const [k, v] of ma) if (mb.get(k) !== v) return false;
  return true;
}

export type ReconciliationDecision = "SAFE_MATCH" | "MANUAL_REVIEW";

export type ReconciliationContext = {
  /** true si hay exactamente una persona candidata por documento. */
  singleCandidate: boolean;
  /** true si la persona ya está vinculada a un código SIE distinto. */
  alreadyLinkedToOtherCode: boolean;
  /** true si la persona tiene postulación COMPLETED (ya está en V2). */
  hasCompletedApplication: boolean;
};

export function classifyReconciliation(
  sie: NamePart,
  person: PersonNamePart,
  ctx: ReconciliationContext,
): ReconciliationDecision {
  if (!ctx.singleCandidate) return "MANUAL_REVIEW";
  if (ctx.alreadyLinkedToOtherCode) return "MANUAL_REVIEW";
  if (ctx.hasCompletedApplication) return "MANUAL_REVIEW";
  if (!areNameMultisetsEqual(sie, person)) return "MANUAL_REVIEW";
  return "SAFE_MATCH";
}
