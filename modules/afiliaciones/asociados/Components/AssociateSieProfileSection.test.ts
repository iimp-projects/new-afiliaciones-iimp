import { describe, expect, it } from "vitest";
import { sortSieQuotas } from "./AssociateSieProfileSection";

describe("sortSieQuotas", () => {
  it("shows recent SIE records first without mutating or deduplicating the upstream data", () => {
    const quotas = [
      { concepto: "CUOTA" as const, numero: 1, monto: 1, moneda: "S/" as const, anno: 2025, tipo: "Activo", estadoContable: "Facturado" as const, fechaPago: "2025-01-01", fechaInicio: "2025-01-01", fechaFin: "2025-12-31", docGSer: "F001", docGNro: "1" },
      { concepto: "CUOTA" as const, numero: 2, monto: 1, moneda: "S/" as const, anno: 2026, tipo: "Activo", estadoContable: "Facturado" as const, fechaPago: "2026-01-01", fechaInicio: "2026-01-01", fechaFin: "2026-12-31", docGSer: "F001", docGNro: "2" },
      { concepto: "CUOTA" as const, numero: 3, monto: 1, moneda: "S/" as const, anno: 2026, tipo: "Activo", estadoContable: "Facturado" as const, fechaPago: "2026-01-01", fechaInicio: "2026-01-01", fechaFin: "2026-12-31", docGSer: "F001", docGNro: "3" },
    ];
    expect(sortSieQuotas(quotas).map((quota) => quota.numero)).toEqual([2, 3, 1]);
    expect(quotas.map((quota) => quota.numero)).toEqual([1, 2, 3]);
  });
});
