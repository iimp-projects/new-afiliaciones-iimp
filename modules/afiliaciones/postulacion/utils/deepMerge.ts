/**
 * Fusión profunda y segura de dos borradores de postulación.
 *
 * A diferencia de la fusión superficial (`{ ...a, ...b }`), este helper evita
 * que una sección enviada parcialmente (p. ej. `personalInformation` sin todos
 * sus campos) sobrescriba los valores ya persistidos.
 *
 * Reglas:
 *  - `undefined` o `null` en `proposed`: conserva el valor anterior.
 *  - objeto plano en ambos lados: fusión recursiva por clave.
 *  - primitivos, arrays u objetos incompatibles: gana `proposed`.
 *
 * Esta semántica es la que corrige la pérdida documental en subsanaciones,
 * donde el frontend puede reenviar campos de documento como `null`.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function deepMergeDraft(current: unknown, proposed: unknown): unknown {
  if (proposed === undefined || proposed === null) {
    return current;
  }

  if (!isPlainObject(current) || !isPlainObject(proposed)) {
    return proposed;
  }

  const out: Record<string, unknown> = { ...current };
  for (const [key, value] of Object.entries(proposed)) {
    out[key] = deepMergeDraft((current as Record<string, unknown>)[key], value);
  }
  return out;
}
