import type { QuotaAccountingStatus, QuotaConcept } from "@prisma/client";

export type QuotaFinancialRow = {
  year: number;
  concept: QuotaConcept;
  currency: string;
  accountingStatus: QuotaAccountingStatus;
  amount: string;
};

export type QuotaMoneyTotal = { count: number; amount: string };

export type QuotaFinancialSummary = {
  byCurrency: Record<string, QuotaMoneyTotal>;
  byConceptCurrencyStatus: Array<{
    concept: QuotaConcept;
    currency: string;
    accountingStatus: QuotaAccountingStatus;
    count: number;
    amount: string;
  }>;
  byYearCurrency: Array<{ year: number; currency: string; count: number; amount: string }>;
};
