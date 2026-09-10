/** Returns the membership calendar year for an instant, explicitly in Peru time. */
export function getMembershipYear(effectiveAt: Date): number {
  if (!(effectiveAt instanceof Date) || Number.isNaN(effectiveAt.getTime())) throw new Error("La fecha efectiva de afiliación no es válida.");
  const year = new Intl.DateTimeFormat("en-US", { timeZone: "America/Lima", year: "numeric" }).formatToParts(effectiveAt).find((part) => part.type === "year")?.value;
  if (!year) throw new Error("No se pudo resolver el año de afiliación.");
  return Number(year);
}
