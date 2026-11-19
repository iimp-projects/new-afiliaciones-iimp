import { Prisma, type QuotaAccountingStatus, type QuotaConcept } from "@prisma/client";
import type { QuotaFinancialRow, QuotaFinancialSummary, QuotaMoneyTotal } from "../Models/QuotaFinancialSummary";

type Bucket = { count: number; amount: Prisma.Decimal };

/**
 * Agrega importes sin mezclar monedas. No expone un total global porque
 * PEN y USD no son sumables entre sí.
 */
export class QuotaFinancialSummaryService {
  summarize(rows: readonly QuotaFinancialRow[]): QuotaFinancialSummary {
    const byCurrency = new Map<string, Bucket>();
    const byConcept = new Map<string, Bucket & { concept: QuotaConcept; currency: string; accountingStatus: QuotaAccountingStatus }>();
    const byYear = new Map<string, Bucket & { year: number; currency: string }>();

    for (const row of rows) {
      this.add(byCurrency, row.currency, row.amount);
      const conceptKey = `${row.concept}|${row.currency}|${row.accountingStatus}`;
      const conceptBucket = byConcept.get(conceptKey) ?? { count: 0, amount: new Prisma.Decimal(0), concept: row.concept, currency: row.currency, accountingStatus: row.accountingStatus };
      conceptBucket.count += 1;
      conceptBucket.amount = conceptBucket.amount.plus(new Prisma.Decimal(row.amount));
      byConcept.set(conceptKey, conceptBucket);
      const yearKey = `${row.year}|${row.currency}`;
      const yearBucket = byYear.get(yearKey) ?? { count: 0, amount: new Prisma.Decimal(0), year: row.year, currency: row.currency };
      yearBucket.count += 1;
      yearBucket.amount = yearBucket.amount.plus(new Prisma.Decimal(row.amount));
      byYear.set(yearKey, yearBucket);
    }

    return {
      byCurrency: Object.fromEntries([...byCurrency.entries()].map(([currency, bucket]) => [currency, this.total(bucket)])),
      byConceptCurrencyStatus: [...byConcept.values()]
        .map((bucket) => ({ concept: bucket.concept, currency: bucket.currency, accountingStatus: bucket.accountingStatus, ...this.total(bucket) }))
        .sort((a, b) => a.currency.localeCompare(b.currency) || a.concept.localeCompare(b.concept) || a.accountingStatus.localeCompare(b.accountingStatus)),
      byYearCurrency: [...byYear.values()]
        .map((bucket) => ({ year: bucket.year, currency: bucket.currency, ...this.total(bucket) }))
        .sort((a, b) => a.year - b.year || a.currency.localeCompare(b.currency)),
    };
  }

  private add(map: Map<string, Bucket>, currency: string, amount: string): void {
    const bucket = map.get(currency) ?? { count: 0, amount: new Prisma.Decimal(0) };
    bucket.count += 1;
    bucket.amount = bucket.amount.plus(new Prisma.Decimal(amount));
    map.set(currency, bucket);
  }

  private total(bucket: Bucket): QuotaMoneyTotal {
    return { count: bucket.count, amount: bucket.amount.toFixed(2) };
  }
}
