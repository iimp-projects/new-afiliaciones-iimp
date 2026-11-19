import type { QuotaUpsertAction } from "../Models/QuotaModels";

/**
 * Decide la operación de persistencia comparando únicamente la huella financiera.
 * La identidad ya está fijada por sourceKey; un cambio de monto o estado
 * actualiza el mismo registro y nunca crea una cuota nueva.
 */
export function planQuotaUpsert(
  existing: { sourcePayloadHash: string } | null,
  incoming: { sourcePayloadHash: string },
): QuotaUpsertAction {
  if (!existing) return "INSERTED";
  return existing.sourcePayloadHash === incoming.sourcePayloadHash ? "UNCHANGED" : "UPDATED";
}
