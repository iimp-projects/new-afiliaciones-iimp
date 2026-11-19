import { Prisma, type QuotaConcept } from "@prisma/client";
import type { QuotaConceptTotal } from "../Models/QuotaAdmin";
import type { QuotaGroupRow } from "../Repositories/Interfaces/IQuotaAdminRepository";

export function buildConceptTotal(concept: QuotaConcept, groups: readonly QuotaGroupRow[]): QuotaConceptTotal {
  const scoped = groups.filter((group) => group.concept === concept);
  let facturadoCount = 0;
  let pendienteCount = 0;
  for (const group of scoped) {
    if (group.accountingStatus === "FACTURADO") facturadoCount += group.count;
    if (group.accountingStatus === "PENDIENTE") pendienteCount += group.count;
  }
  const sumByStatus = (status: "FACTURADO" | "PENDIENTE") => {
    const map = new Map<string, { count: number; amount: Prisma.Decimal }>();
    for (const group of scoped.filter((entry) => entry.accountingStatus === status)) {
      const current = map.get(group.currency) ?? { count: 0, amount: new Prisma.Decimal(0) };
      current.count += group.count;
      current.amount = current.amount.plus(new Prisma.Decimal(group.amount));
      map.set(group.currency, current);
    }
    return [...map.entries()].map(([currency, value]) => ({ currency, count: value.count, amount: value.amount.toFixed(2) }));
  };
  return {
    concept,
    count: scoped.reduce((sum, group) => sum + group.count, 0),
    facturadoCount,
    pendienteCount,
    facturadoByCurrency: sumByStatus("FACTURADO"),
    pendienteByCurrency: sumByStatus("PENDIENTE"),
  };
}
