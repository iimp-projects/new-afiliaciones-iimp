export function buildAssociateCode(personId: number | null | undefined): string | null {
  if (typeof personId !== "number" || !Number.isInteger(personId) || personId < 1) return null;
  return `A-${String(personId).padStart(4, "0")}`;
}
