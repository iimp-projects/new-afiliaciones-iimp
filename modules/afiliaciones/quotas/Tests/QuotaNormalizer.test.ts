import { describe, expect, it } from "vitest";
import { QuotaNormalizer } from "../Services/QuotaNormalizer";
import { quotaFixture } from "./quotaFixtures";

const normalizer = new QuotaNormalizer();
const person = { provider: "SIE", documentType: "DNI", documentNumber: "00123456", institutionalCode: "000123" };

describe("QuotaNormalizer", () => {
  it("normaliza el contrato SIE sin inventar estados ni campos", () => {
    const quota = normalizer.normalize(quotaFixture(), person);
    expect(quota).toMatchObject({
      provider: "SIE",
      concept: "CUOTA",
      quotaNumber: 1,
      year: 2026,
      currency: "S/",
      amount: "150.00",
      accountingStatus: "FACTURADO",
      membershipType: "Activo",
      paidAt: "2026-01-05",
      periodStart: "2026-01-05",
      periodEnd: "2027-01-04",
      receiptSerie: "F009",
      receiptNumber: "3298",
      institutionalCode: "000123",
    });
  });

  it("preserva moneda y monto cero sin inferir exoneración", () => {
    const zero = normalizer.normalize(quotaFixture({ monto: 0, moneda: "US$", estadoContable: "Pendiente", fechaPago: "" }), person);
    expect(zero.amount).toBe("0.00");
    expect(zero.currency).toBe("US$");
    expect(zero.accountingStatus).toBe("PENDIENTE");
    expect(zero.paidAt).toBeNull();
  });

  it("convierte comprobantes vacíos en nulos sin perder el original no vacío", () => {
    const quota = normalizer.normalize(quotaFixture({ docGSer: "", docGNro: "  " }), person);
    expect(quota.receiptSerie).toBeNull();
    expect(quota.receiptNumber).toBeNull();
  });

  it("cambia la huella cuando cambia el monto o el estado contable", () => {
    const base = normalizer.normalize(quotaFixture(), person);
    const amount = normalizer.normalize(quotaFixture({ monto: 200 }), person);
    const status = normalizer.normalize(quotaFixture({ estadoContable: "Pendiente", fechaPago: "" }), person);
    expect(amount.sourceKey).toBe(base.sourceKey);
    expect(amount.sourcePayloadHash).not.toBe(base.sourcePayloadHash);
    expect(status.sourceKey).toBe(base.sourceKey);
    expect(status.sourcePayloadHash).not.toBe(base.sourcePayloadHash);
  });

  it("no cambia la huella financiera por metadatos de identidad", () => {
    const base = normalizer.normalize(quotaFixture(), person);
    const otherCode = normalizer.normalize(quotaFixture(), { ...person, institutionalCode: "999999" });
    expect(otherCode.sourcePayloadHash).toBe(base.sourcePayloadHash);
    expect(otherCode.institutionalCode).toBe("999999");
  });

  it("rechaza montos, monedas, fechas y estados fuera del contrato", () => {
    expect(() => normalizer.normalize(quotaFixture({ monto: -1 }), person)).toThrowError(/monto/i);
    expect(() => normalizer.normalize(quotaFixture({ monto: 1.999 }), person)).toThrowError(/precisión/i);
    expect(() => normalizer.normalize(quotaFixture({ moneda: "PEN" as "S/" }), person)).toThrowError(/moneda/i);
    expect(() => normalizer.normalize(quotaFixture({ fechaPago: "2026-02-31" }), person)).toThrowError(/fecha/i);
    expect(() => normalizer.normalize(quotaFixture({ estadoContable: "Pagado" as "Facturado" }), person)).toThrowError(/estado contable/i);
  });

  it("exige número en CUOTA y lo prohíbe en INSCRIPCION", () => {
    expect(() => normalizer.normalize(quotaFixture({ numero: null }), person)).toThrowError(/número entero positivo/i);
    expect(() => normalizer.normalize(quotaFixture({ concepto: "INSCRIPCION", numero: 1 }), person)).toThrowError(/inscripción/i);
  });

  it("detecta duplicados de identidad dentro de una respuesta", () => {
    expect(() => normalizer.normalizeAll([quotaFixture(), quotaFixture()], person)).toThrowError(/duplicada/i);
  });

  it("mantiene la clave legacy cuando existe una sola inscripción", () => {
    const quota = normalizer.normalize(quotaFixture({ concepto: "INSCRIPCION", numero: null, anno: 2019 }), person);
    expect(quota.sourceKey.endsWith("|INSCRIPCION|INSCRIPCION")).toBe(true);
  });

  it("distingue inscripciones múltiples por año sin tocar CUOTA", () => {
    const quotas = normalizer.normalizeAll([
      quotaFixture({ concepto: "INSCRIPCION", numero: null, anno: 2019, monto: 0, estadoContable: "Pendiente", fechaPago: "" }),
      quotaFixture({ concepto: "INSCRIPCION", numero: null, anno: 2020, monto: 0, estadoContable: "Pendiente", fechaPago: "" }),
      quotaFixture({ monto: 150 }),
    ], person);
    expect(new Set(quotas.map((quota) => quota.sourceKey)).size).toBe(3);
    expect(quotas[0].sourceKey.endsWith("|INSCRIPCION|INSCRIPCION")).toBe(true);
    expect(quotas[1].sourceKey.endsWith("|INSCRIPCION|Y2020")).toBe(true);
    expect(quotas[2].sourceKey).toContain("|CUOTA|2026|1");
  });

  it("no reasigna la clave legacy si la inscripción legacy desaparece temporalmente", () => {
    const remaining = normalizer.normalizeAll([
      quotaFixture({ concepto: "INSCRIPCION", numero: null, anno: 2021, monto: 0, estadoContable: "Pendiente", fechaPago: "" }),
    ], person, 2019);
    expect(remaining[0].sourceKey.endsWith("|INSCRIPCION|Y2021")).toBe(true);
  });

  it("conserva la clave legacy del año existente aunque aparezca un año anterior", () => {
    const quotas = normalizer.normalizeAll([
      quotaFixture({ concepto: "INSCRIPCION", numero: null, anno: 2018, monto: 0, estadoContable: "Pendiente", fechaPago: "" }),
      quotaFixture({ concepto: "INSCRIPCION", numero: null, anno: 2019, monto: 0, estadoContable: "Pendiente", fechaPago: "" }),
      quotaFixture({ concepto: "INSCRIPCION", numero: null, anno: 2021, monto: 0, estadoContable: "Pendiente", fechaPago: "" }),
    ], person, 2019);
    expect(quotas.find((quota) => quota.year === 2019)?.sourceKey.endsWith("|INSCRIPCION|INSCRIPCION")).toBe(true);
    expect(quotas.find((quota) => quota.year === 2018)?.sourceKey.endsWith("|INSCRIPCION|Y2018")).toBe(true);
    expect(quotas.find((quota) => quota.year === 2021)?.sourceKey.endsWith("|INSCRIPCION|Y2021")).toBe(true);
  });

  it("mantiene la clave de la inscripción existente al aparecer una nueva", () => {
    const existing = normalizer.normalize(quotaFixture({ concepto: "INSCRIPCION", numero: null, anno: 2019 }), person);
    const withNew = normalizer.normalizeAll([
      quotaFixture({ concepto: "INSCRIPCION", numero: null, anno: 2019, monto: 0, estadoContable: "Pendiente", fechaPago: "" }),
      quotaFixture({ concepto: "INSCRIPCION", numero: null, anno: 2021, monto: 0, estadoContable: "Pendiente", fechaPago: "" }),
    ], person);
    expect(withNew[0].sourceKey).toBe(existing.sourceKey);
    expect(withNew[1].sourceKey.endsWith("|INSCRIPCION|Y2021")).toBe(true);
  });

  it("falla cerrado si hay dos inscripciones del mismo año", () => {
    expect(() => normalizer.normalizeAll([
      quotaFixture({ concepto: "INSCRIPCION", numero: null, anno: 2019 }),
      quotaFixture({ concepto: "INSCRIPCION", numero: null, anno: 2019 }),
    ], person)).toThrowError(/mismo año/i);
  });
});
