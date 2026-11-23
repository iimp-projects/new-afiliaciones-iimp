import type { SieAssociateStateQuota } from "@/modules/afiliaciones/associates-integration/Models/AssociateIntegration";

export const quotaFixture = (overrides: Partial<SieAssociateStateQuota> = {}): SieAssociateStateQuota => ({
  concepto: "CUOTA",
  numero: 1,
  monto: 150,
  moneda: "S/",
  anno: 2026,
  tipo: "Activo",
  estadoContable: "Facturado",
  fechaPago: "2026-01-05",
  fechaInicio: "2026-01-05",
  fechaFin: "2027-01-04",
  docGSer: "F009",
  docGNro: "3298",
  ...overrides,
});

export const quotaPerson = {
  provider: "SIE",
  documentType: "DNI",
  documentNumber: "00123456",
  institutionalCode: "000123",
};
