import { describe, expect, it } from "vitest";
import type { QuotaFinancialRow } from "../Models/QuotaFinancialSummary";
import { QuotaFinancialSummaryService } from "../Services/QuotaFinancialSummaryService";

const rows: QuotaFinancialRow[] = [
  { year: 2026, concept: "INSCRIPCION", currency: "S/", accountingStatus: "FACTURADO", amount: "557995.00" },
  { year: 2026, concept: "INSCRIPCION", currency: "S/", accountingStatus: "PENDIENTE", amount: "950.00" },
  { year: 2026, concept: "CUOTA", currency: "S/", accountingStatus: "FACTURADO", amount: "4085051.50" },
  { year: 2026, concept: "CUOTA", currency: "S/", accountingStatus: "PENDIENTE", amount: "2013247.50" },
  { year: 2026, concept: "INSCRIPCION", currency: "US$", accountingStatus: "FACTURADO", amount: "17891.18" },
  { year: 2026, concept: "INSCRIPCION", currency: "US$", accountingStatus: "PENDIENTE", amount: "9400.00" },
  { year: 2026, concept: "CUOTA", currency: "US$", accountingStatus: "FACTURADO", amount: "245063.18" },
  { year: 2026, concept: "CUOTA", currency: "US$", accountingStatus: "PENDIENTE", amount: "678042.00" },
];

describe("QuotaFinancialSummaryService", () => {
  it("separa monedas y reproduce los totales financieros correctos", () => {
    const summary = new QuotaFinancialSummaryService().summarize(rows);
    expect(summary.byCurrency).toEqual({
      "S/": { count: 4, amount: "6657244.00" },
      "US$": { count: 4, amount: "950396.36" },
    });
    expect(summary.byCurrency["S/"].amount).toBe("6657244.00");
    expect(summary.byCurrency["US$"].amount).toBe("950396.36");
    expect(summary).not.toHaveProperty("total");
    expect(summary).not.toHaveProperty("totalAmount");
  });

  it("separa FACTURADO y PENDIENTE por moneda", () => {
    const summary = new QuotaFinancialSummaryService().summarize(rows);
    const facturado = summary.byConceptCurrencyStatus
      .filter((row) => row.accountingStatus === "FACTURADO")
      .reduce((acc, row) => {
        acc[row.currency] = (acc[row.currency] ?? 0) + Number(row.amount);
        return acc;
      }, {} as Record<string, number>);
    expect(facturado).toEqual({ "S/": 4643046.5, "US$": 262954.36 });

    const pendiente = summary.byConceptCurrencyStatus
      .filter((row) => row.accountingStatus === "PENDIENTE")
      .reduce((acc, row) => {
        acc[row.currency] = (acc[row.currency] ?? 0) + Number(row.amount);
        return acc;
      }, {} as Record<string, number>);
    expect(pendiente).toEqual({ "S/": 2014197.5, "US$": 687442 });
  });

  it("no mezcla conceptos dentro de la misma moneda", () => {
    const summary = new QuotaFinancialSummaryService().summarize(rows);
    const inscripcion = summary.byConceptCurrencyStatus.filter((row) => row.concept === "INSCRIPCION" && row.currency === "S/");
    const cuota = summary.byConceptCurrencyStatus.filter((row) => row.concept === "CUOTA" && row.currency === "S/");
    expect(inscripcion.reduce((sum, row) => sum + Number(row.amount), 0)).toBe(558945);
    expect(cuota.reduce((sum, row) => sum + Number(row.amount), 0)).toBe(6098299);
  });

  it("mantiene Decimal en la agregación", () => {
    const summary = new QuotaFinancialSummaryService().summarize([
      { year: 2024, concept: "CUOTA", currency: "US$", accountingStatus: "PENDIENTE", amount: "0.10" },
      { year: 2024, concept: "CUOTA", currency: "US$", accountingStatus: "PENDIENTE", amount: "0.20" },
    ]);
    expect(summary.byCurrency["US$"].amount).toBe("0.30");
  });
});
