/**
 * Comparación de borradores para la subsanación de observaciones.
 *
 * El flujo de subsanación recibe del frontend el `draftData` completo (no solo
 * los campos observados). Para no rechazar subsanaciones válidas por
 * diferencias de normalización involuntarias (p. ej. `null` vs `""` que
 * introduce la persistencia de la información laboral), la comparación se
 * realiza de forma semántica:
 *
 *  - `null`, `undefined` y `""` se consideran equivalentes (valor vacío).
 *  - La comparación es profunda y, salvo esa normalización, idéntica a la
 *    original: solo se permite modificar las rutas observadas (o en cascada).
 */

/**
 * Normaliza un valor para comparación estructural, tratando `null`,
 * `undefined` y la cadena vacía como un mismo "vacío".
 */
export function normalizeForComparison(value: unknown): unknown {
  if (value === null || value === undefined || value === "") return null;
  if (Array.isArray(value)) return value.map(normalizeForComparison);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      const normalized = normalizeForComparison(item);
      if (normalized !== null) out[key] = normalized;
    }
    return out;
  }
  return value;
}

export interface UnauthorizedChange {
  path: string;
}

/**
 * Encuentra la primera ruta modificada que NO está permitida por la
 * observación. Devuelve `null` si el borrador propuesto solo modifica campos
 * observados (o no modifica nada).
 *
 * Semántica idéntica a la comparación original de `ensureEditable`, pero
 * comparando los valores normalizados con {@link normalizeForComparison}.
 */
export function findUnauthorizedChange(
  current: Record<string, unknown>,
  proposed: Record<string, unknown>,
  allowedToModify: ReadonlySet<string>,
): UnauthorizedChange | null {
  const compare = (before: unknown, after: unknown, path = ""): UnauthorizedChange | null => {
    if (JSON.stringify(normalizeForComparison(before)) === JSON.stringify(normalizeForComparison(after))) {
      return null;
    }
    if (path && allowedToModify.has(path)) return null;
    if (before && after && typeof before === "object" && typeof after === "object") {
      const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
      for (const key of keys) {
        const result = compare(
          (before as Record<string, unknown>)[key],
          (after as Record<string, unknown>)[key],
          path ? `${path}.${key}` : key,
        );
        if (result) return result;
      }
      return null;
    }
    if (!allowedToModify.has(path)) return { path };
    return null;
  };

  for (const section of Object.keys(proposed)) {
    const result = compare(current[section], proposed[section], section);
    if (result) return result;
  }
  return null;
}
