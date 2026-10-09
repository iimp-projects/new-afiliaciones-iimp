import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AssociateSieProfileSection, sortSieQuotas } from "./AssociateSieProfileSection";

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

  it("uses non-retryable authentication and authorization states in the SIE detail tab", () => {
    const render = (state: Parameters<typeof AssociateSieProfileSection>[0]["state"]) => renderToStaticMarkup(createElement(AssociateSieProfileSection, { state, onRefresh: vi.fn() }));

    expect(render({ kind: "unauthenticated" })).toContain("Sesión expirada");
    expect(render({ kind: "unauthenticated" })).not.toContain("Reintentar");
    expect(render({ kind: "forbidden" })).toContain("No tienes permiso");
    expect(render({ kind: "forbidden" })).not.toContain("Reintentar");
    expect(render({ kind: "error", message: "SIE no está disponible.", retryable: true })).toContain("Reintentar");
    expect(render({ kind: "error", message: "Error interno.", retryable: false })).not.toContain("Reintentar");
  });
});
