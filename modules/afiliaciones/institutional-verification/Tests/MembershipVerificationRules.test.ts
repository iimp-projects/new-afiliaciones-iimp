import { describe, expect, it } from "vitest";
import type { SieAssociateState, SieAssociateStateQuota } from "@/modules/afiliaciones/associates-integration/Models/AssociateIntegration";
import {
  classifyVerification,
  determineActiveStudentVigencia,
  determineMembershipType,
  peruToday,
} from "../Rules/MembershipVerificationRules";

const NOW = new Date("2026-06-15T12:00:00.000Z");

function quota(overrides: Partial<SieAssociateStateQuota> = {}): SieAssociateStateQuota {
  return {
    concepto: "CUOTA",
    numero: 1,
    monto: 100,
    moneda: "S/",
    anno: 2026,
    tipo: "Activo",
    estadoContable: "Facturado",
    fechaPago: "2026-01-01",
    fechaInicio: "2026-01-01",
    fechaFin: "2026-12-31",
    docGSer: "",
    docGNro: "",
    ...overrides,
  };
}

function state(cuotas: SieAssociateStateQuota[]): SieAssociateState {
  return { status: true, cuotas };
}

describe("classifyVerification", () => {
  it("1. asociado ACTIVE vigente es elegible", () => {
    const result = classifyVerification(state([quota()]), NOW);
    expect(result).toMatchObject({
      status: "ELIGIBLE",
      associate: true,
      membershipType: "ACTIVE",
      eligible: true,
      vigencia: "VIGENTE",
    });
  });

  it("1. asociado STUDENT vigente es elegible", () => {
    const result = classifyVerification(state([quota({ tipo: "Estudiante", monto: 0 })]), NOW);
    expect(result).toMatchObject({ status: "ELIGIBLE", membershipType: "STUDENT", eligible: true, vigencia: "VIGENTE" });
  });

  it("2. asociado ADHERENTE vigente no es elegible", () => {
    const result = classifyVerification(state([quota({ tipo: "Adherente" })]), NOW);
    expect(result).toMatchObject({ status: "INELIGIBLE", associate: true, membershipType: "ADHERENTE", eligible: false, vigencia: "VIGENTE" });
  });

  it("3. asociado ACTIVE sin vigencia (periodo facturado vencido) no es elegible", () => {
    const result = classifyVerification(
      state([quota({ anno: 2025, fechaInicio: "2025-01-01", fechaFin: "2025-12-31" })]),
      NOW,
    );
    expect(result).toMatchObject({ status: "INELIGIBLE", membershipType: "ACTIVE", eligible: false, vigencia: "NO_VIGENTE" });
  });

  it("3. asociado ACTIVE con cuota pendiente no es elegible", () => {
    const result = classifyVerification(state([quota({ estadoContable: "Pendiente" })]), NOW);
    expect(result).toMatchObject({ status: "INELIGIBLE", membershipType: "ACTIVE", eligible: false, vigencia: "NO_VIGENTE" });
  });

  it("4. no asociado confirmado por SIE", () => {
    const result = classifyVerification({ status: false, message: "No encontrado" }, NOW);
    expect(result).toMatchObject({ status: "NOT_ASSOCIATE", associate: false, membershipType: null, eligible: null, vigencia: null });
  });

  it("6. VITALICIO no exige cuotas facturadas y es elegible", () => {
    const result = classifyVerification(state([quota({ tipo: "Vitalicio", estadoContable: "Pendiente", fechaPago: "", fechaInicio: "", fechaFin: "" })]), NOW);
    expect(result).toMatchObject({ status: "ELIGIBLE", membershipType: "VITALICIO", eligible: true, vigencia: "VIGENTE" });
  });

  it("6. HONORARIO no exige cuotas facturadas y es elegible", () => {
    const result = classifyVerification(state([quota({ tipo: "Honorario", estadoContable: "Pendiente", fechaPago: "", fechaInicio: "", fechaFin: "" })]), NOW);
    expect(result).toMatchObject({ status: "ELIGIBLE", membershipType: "HONORARIO", eligible: true, vigencia: "VIGENTE" });
  });

  it.each(["Fallecido", "Renunciante", "Separado", "Anulado"] as const)("8. estado terminal %s no es elegible", (tipo) => {
    const result = classifyVerification(state([quota({ tipo })]), NOW);
    expect(result).toMatchObject({ status: "INELIGIBLE", associate: true, membershipType: tipo === "Fallecido" ? "FALLECIDO" : tipo === "Renunciante" ? "RENUNCIANTE" : tipo === "Separado" ? "SEPARADO" : "ANULADO", eligible: false, vigencia: null });
  });

  it("9. cuotas vacías producen estado indeterminado sin inventar elegibilidad", () => {
    const result = classifyVerification(state([]), NOW);
    expect(result).toMatchObject({ status: "INDETERMINATE", associate: true, membershipType: null, eligible: null, vigencia: null });
  });

  it("9. tipo de membresía desconocido produce estado indeterminado", () => {
    const result = classifyVerification(state([quota({ tipo: "Desconocido" as SieAssociateStateQuota["tipo"] })]), NOW);
    expect(result.status).toBe("INDETERMINATE");
    expect(result.eligible).toBeNull();
  });

  it("9. ACTIVE con solo INSCRIPCION (sin CUOTA) es indeterminado", () => {
    const result = classifyVerification(
      state([{ ...quota(), concepto: "INSCRIPCION", numero: null, fechaInicio: "2026-01-01", fechaFin: "2026-12-31" }]),
      NOW,
    );
    expect(result).toMatchObject({ status: "INDETERMINATE", membershipType: "ACTIVE", eligible: null, vigencia: "INDETERMINATE" });
  });

  it("9. ACTIVE con cuota facturada de periodo inconsistente es indeterminado", () => {
    const result = classifyVerification(state([quota({ fechaInicio: "2026-12-31", fechaFin: "2026-01-01" })]), NOW);
    expect(result).toMatchObject({ status: "INDETERMINATE", eligible: null, vigencia: "INDETERMINATE" });
  });
});

describe("determineMembershipType", () => {
  it("elige el tipo de la cuota más reciente", () => {
    const result = determineMembershipType([
      quota({ anno: 2024, tipo: "Activo", fechaInicio: "2024-01-01", fechaFin: "2024-12-31" }),
      quota({ anno: 2026, tipo: "Renunciante", fechaInicio: "2026-01-01", fechaFin: "2026-12-31" }),
    ]);
    expect(result).toBe("RENUNCIANTE");
  });

  it("devuelve null cuando no hay tipo reconocible", () => {
    expect(determineMembershipType([])).toBeNull();
    expect(determineMembershipType([quota({ tipo: "N/A" as SieAssociateStateQuota["tipo"] })])).toBeNull();
  });

  it("devuelve null cuando dos cuotas comparten recencia con tipos distintos", () => {
    const result = determineMembershipType([
      quota({ tipo: "Activo" }),
      quota({ tipo: "Estudiante" }),
    ]);
    expect(result).toBeNull();
  });
});

describe("determineActiveStudentVigencia", () => {
  it("VIGENTE cuando una cuota facturada cubre hoy", () => {
    expect(determineActiveStudentVigencia([quota()], "2026-06-15")).toBe("VIGENTE");
  });

  it("NO_VIGENTE cuando el último periodo facturado ya venció", () => {
    expect(determineActiveStudentVigencia([quota({ anno: 2025, fechaInicio: "2025-01-01", fechaFin: "2025-12-31" })], "2026-06-15")).toBe("NO_VIGENTE");
  });

  it("INDETERMINATE cuando no hay cuotas CUOTA", () => {
    expect(determineActiveStudentVigencia([], "2026-06-15")).toBe("INDETERMINATE");
  });
});

describe("peruToday", () => {
  it("formatea la fecha en America/Lima como YYYY-MM-DD", () => {
    expect(peruToday(new Date("2026-06-15T12:00:00.000Z"))).toBe("2026-06-15");
    expect(peruToday(new Date("2026-01-01T04:00:00.000Z"))).toBe("2025-12-31");
  });
});
