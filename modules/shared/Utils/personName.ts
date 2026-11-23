/** Formatea un nombre completo como "Apellido Paterno Apellido Materno, Nombres". */
export function formatFullName(
  firstName?: string | null,
  paternalLastName?: string | null,
  maternalLastName?: string | null,
): string {
  const lastNames = [paternalLastName, maternalLastName]
    .filter((value): value is string => Boolean(value && value.trim()))
    .join(" ");
  const names = firstName?.trim() ?? "";
  if (lastNames && names) return `${lastNames}, ${names}`;
  return lastNames || names;
}
