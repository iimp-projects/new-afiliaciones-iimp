import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MembershipSieQuotaSummary, summarizeMembershipSieQuotas } from "./MembershipSieQuotaSummary";
import type { AssociateSieProfileViewState } from "./AssociateSieProfileSection";

const quota = (overrides: Record<string, unknown> = {}) => ({
  concepto: "CUOTA" as const,
  numero: 1,
  monto: 150,
  moneda: "S/" as const,
  anno: 2026,
  tipo: "Activo" as const,
  estadoContable: "Facturado" as const,
  fechaPago: "2026-01-03",
  fechaInicio: "2026-01-01",
  fechaFin: "2026-12-31",
  docGSer: "F001",
  docGNro: "20",
  ...overrides,
});

const render = (state: AssociateSieProfileViewState, canReadMemberships = true) => renderToStaticMarkup(<MembershipSieQuotaSummary state={state} canReadMemberships={canReadMemberships} onRetry={vi.fn()} onViewDetails={vi.fn()}/>);

describe("MembershipSieQuotaSummary", () => {
  it("clasifica exclusivamente cuotas por concepto y estado contable, conservando Anulado sin reinterpretarlo", () => {
    const summary = summarizeMembershipSieQuotas([
      quota(),
      quota({ numero: 2, estadoContable: "Pendiente", monto: 25, moneda: "S/", fechaPago: "", fechaInicio: "", fechaFin: "", tipo: "Anulado" }),
      quota({ numero: 3, estadoContable: "Pendiente", monto: 10, moneda: "US$", fechaPago: "", fechaInicio: "", fechaFin: "" }),
      quota({ concepto: "INSCRIPCION", numero: null, estadoContable: "Facturado" }),
    ] as never);

    expect(summary.invoicedCount).toBe(1);
    expect(summary.pendingCount).toBe(2);
    expect(summary.pendingAmounts).toEqual([{ currency: "S/", amount: 25 }, { currency: "US$", amount: 10 }]);
  });

  it("no inventa un fin de vigencia cuando no existe una cuota facturada válida", () => {
    const summary = summarizeMembershipSieQuotas([quota({ estadoContable: "Pendiente", fechaPago: "", fechaInicio: "", fechaFin: "" })] as never);

    expect(summary.latestInvoicedPeriod).toBeNull();
    expect(render({ kind: "loaded", data: { registered: true, checkedAt: "2026-01-01T00:00:00.000Z", quotas: [quota({ estadoContable: "Pendiente", fechaPago: "", fechaInicio: "", fechaFin: "" })] } })).toContain("No disponible");
  });

  it("representa disponibilidad vacía, error, no registrado y sin permiso sin solicitar datos", () => {
    expect(render({ kind: "idle" })).toContain("aún no fue consultada");
    expect(render({ kind: "loading" })).toContain("Consultando cuotas");
    expect(render({ kind: "error", message: "SIE no disponible" })).toContain("SIE no disponible");
    expect(render({ kind: "loaded", data: { registered: false, checkedAt: "2026-01-01T00:00:00.000Z" } })).toContain("no está registrado");
    expect(render({ kind: "forbidden" }, false)).toContain("Sin permiso");
  });

  it("muestra el acceso al detalle SIE con datos disponibles", () => {
    expect(render({ kind: "loaded", data: { registered: true, checkedAt: "2026-01-01T00:00:00.000Z", quotas: [quota()] } })).toContain("Ver detalle en SIE");
  });
});
