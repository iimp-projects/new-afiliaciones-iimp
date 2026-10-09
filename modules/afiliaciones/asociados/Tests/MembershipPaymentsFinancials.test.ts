import { describe, expect, it } from "vitest";
import { buildEconomicRows, summarizeSieFinancials } from "../Views/AsociadoDetailContent";

const postmanQuotas = [
  { concepto: "INSCRIPCION", numero: null, monto: 150, moneda: "S/", anno: 2023, tipo: "Activo", estadoContable: "Facturado", fechaPago: "2023-11-27", fechaInicio: "", fechaFin: "", docGSer: "F001", docGNro: "6805" },
  { concepto: "CUOTA", numero: 1, monto: 150, moneda: "S/", anno: 2023, tipo: "Activo", estadoContable: "Facturado", fechaPago: "2023-11-27", fechaInicio: "2023-11-27", fechaFin: "2024-11-26", docGSer: "F001", docGNro: "6805" },
  { concepto: "CUOTA", numero: 2, monto: 150, moneda: "S/", anno: 2024, tipo: "Activo", estadoContable: "Facturado", fechaPago: "2024-12-19", fechaInicio: "2024-11-27", fechaFin: "2025-11-26", docGSer: "F001", docGNro: "8252" },
  { concepto: "CUOTA", numero: 3, monto: 150, moneda: "S/", anno: 2025, tipo: "Activo", estadoContable: "Facturado", fechaPago: "2025-09-13", fechaInicio: "2025-11-27", fechaFin: "2026-11-26", docGSer: "F001", docGNro: "8954" },
];

describe("summarizeSieFinancials", () => {
  it("totaliza lo facturado (histórico) sin interpretarlo como deuda", () => {
    expect(summarizeSieFinancials(postmanQuotas)).toEqual({ invoiced: [{ moneda: "S/", amount: 600 }], pending: [] });
  });

  it("separa el saldo pendiente solo cuando el contrato lo informa", () => {
    const quotas = [
      ...postmanQuotas,
      { concepto: "CUOTA", numero: 4, monto: 150, moneda: "S/", anno: 2026, tipo: "Activo", estadoContable: "Pendiente", fechaPago: "", fechaInicio: "2026-11-27", fechaFin: "2027-11-26", docGSer: "", docGNro: "" },
    ];
    const result = summarizeSieFinancials(quotas);
    expect(result.invoiced).toEqual([{ moneda: "S/", amount: 600 }]);
    expect(result.pending).toEqual([{ moneda: "S/", amount: 150 }]);
  });

  it("devuelve vacío cuando no hay cuotas", () => {
    expect(summarizeSieFinancials([])).toEqual({ invoiced: [], pending: [] });
  });
});

describe("buildEconomicRows", () => {
  it("distingue origen SIE de Sistema de Afiliaciones sin duplicar operaciones", () => {
    const payments = [{ id: 10, status: "PAID", totalAmount: 150, gateway: "NIUBIZ", paymentDate: "2023-11-27" }];
    const rows = buildEconomicRows(postmanQuotas, payments);
    expect(rows).toHaveLength(5);
    expect(rows.filter((row) => row.origen === "SIE")).toHaveLength(4);
    expect(rows.filter((row) => row.origen === "Sistema de Afiliaciones")).toHaveLength(1);
  });

  it("mapea inscripción y cuota a conceptos legibles", () => {
    const rows = buildEconomicRows(postmanQuotas, []);
    expect(rows.find((row) => row.concepto === "Inscripción")).toBeTruthy();
    expect(rows.find((row) => row.concepto === "Cuota 1")).toBeTruthy();
    expect(rows.find((row) => row.concepto === "Cuota 3")).toBeTruthy();
  });
});
