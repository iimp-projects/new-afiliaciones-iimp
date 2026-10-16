/**
 * Selección explícita y segura de UNA cuenta histórica SIE para piloto.
 *
 * Funciones puras (sin I/O) que decide el CLI `sie-legacy-credential.ts`.
 * Garantiza que cualquier ejecución real exija una única cuenta identificada
 * de forma inequívoca por `--user-id` o `--external-code`; `--limit` por sí
 * solo nunca autoriza escrituras.
 */

export interface PilotSelectionArgs {
  userId: number | null;
  externalCode: string | null;
}

/** Extrae los filtros de selección de los argumentos de la línea de comandos. */
export function parsePilotSelectionArgs(argv: string[]): PilotSelectionArgs {
  let userId: number | null = null;
  let externalCode: string | null = null;
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--user-id") {
      const raw = argv[i + 1];
      const parsed = Number(raw);
      if (raw !== undefined && Number.isInteger(parsed) && parsed > 0) {
        userId = parsed;
        i += 1;
      }
    } else if (arg === "--external-code") {
      const raw = argv[i + 1];
      if (raw !== undefined && raw.trim().length > 0) {
        externalCode = raw.trim();
        i += 1;
      }
    }
  }
  return { userId, externalCode };
}

export type SelectionResolution =
  | { ok: true; userId: number }
  | { ok: false; reason: string };

/**
 * Resuelve la selección a un único `userId`, exigiendo consistencia cuando
 * ambos filtros están presentes y rechazando ambigüedades o ausencias.
 */
export function resolveSelection(
  args: PilotSelectionArgs,
  usersByUserId: number[],
  usersByExternalCode: number[],
): SelectionResolution {
  const hasId = args.userId !== null;
  const hasCode = args.externalCode !== null;

  if (hasCode && usersByExternalCode.length > 1) return { ok: false, reason: "AMBIGUOUS_EXTERNAL_CODE" };
  if (hasId && usersByUserId.length > 1) return { ok: false, reason: "AMBIGUOUS_USER_ID" };

  const byId = hasId ? (usersByUserId[0] ?? null) : null;
  const byCode = hasCode ? (usersByExternalCode[0] ?? null) : null;

  if (hasId && hasCode) {
    if (byId === null || byCode === null) return { ok: false, reason: "SELECTION_NOT_FOUND" };
    if (byId !== byCode) return { ok: false, reason: "SELECTION_MISMATCH" };
    return { ok: true, userId: byId };
  }
  if (hasId) return byId === null ? { ok: false, reason: "USER_NOT_FOUND" } : { ok: true, userId: byId };
  if (hasCode) return byCode === null ? { ok: false, reason: "EXTERNAL_CODE_NOT_FOUND" } : { ok: true, userId: byCode };
  return { ok: false, reason: "NO_SELECTION" };
}

/** Guarda de ejecución: el modo `execute` exige selección explícita. */
export function requireExplicitSelectionForExecute(mode: "dry-run" | "execute", args: PilotSelectionArgs): string | null {
  if (mode !== "execute") return null;
  if (args.userId === null && args.externalCode === null) {
    return "EJECUCIÓN REAL requiere selección explícita de una cuenta: --user-id <id> o --external-code <código>. --limit por sí solo no autoriza escrituras.";
  }
  return null;
}
