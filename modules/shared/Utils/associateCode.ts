export const ASSOCIATE_CODE_PREFIX = "A-";
export const ASSOCIATE_CODE_MIN_DIGITS = 5;

export function formatAssociateCode(value: number): string {
  if (!Number.isInteger(value) || value < 1) throw new Error("Código correlativo de asociado inválido.");
  return `${ASSOCIATE_CODE_PREFIX}${String(value).padStart(ASSOCIATE_CODE_MIN_DIGITS, "0")}`;
}

export function parseAssociateCodeNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /^A-(\d{1,10})$/.exec(value.trim());
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function resolveAssociateCode(person: { associateCode?: string | null } | null | undefined): string | null {
  return person?.associateCode?.trim() || null;
}
