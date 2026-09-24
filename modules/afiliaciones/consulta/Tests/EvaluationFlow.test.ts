import { describe, expect, it } from "vitest";
import { areaStatusLabel, deriveEvaluationFlow, formatRegistrationDate } from "../Models/EvaluationFlow";
import type { ApplicationStatusData } from "../Models/ApplicationStatus";

function buildData(overrides: Partial<ApplicationStatusData> = {}): ApplicationStatusData {
  return {
    status: "PENDING",
    applicationCode: "APP-0001",
    affiliateType: "ACTIVE",
    submissionDate: "2026-09-23T12:00:00.000Z",
    areas: {
      sponsors: { status: "PENDING", approvedCount: 0, requiredCount: 2 },
      associates: { status: "PENDING" },
      logistics: { status: "PENDING" },
      board: { status: "PENDING" },
      payment: { status: "PENDING" },
    },
    ...overrides,
  };
}

describe("deriveEvaluationFlow", () => {
  it("ACTIVE incluye avales, asociados y logística en la revisión en paralelo", () => {
    const flow = deriveEvaluationFlow(buildData());
    expect(flow.parallelReviews.map((r) => r.key)).toEqual(["sponsors", "associates", "logistics"]);
  });

  it("STUDENT NO incluye avales (solo asociados y logística)", () => {
    const flow = deriveEvaluationFlow(buildData({ affiliateType: "STUDENT" }));
    expect(flow.parallelReviews.map((r) => r.key)).toEqual(["associates", "logistics"]);
  });

  it("todo pendiente deja la etapa 1 activa", () => {
    const flow = deriveEvaluationFlow(buildData());
    expect(flow.stage1).toBe("active");
    expect(flow.stage2).toBe("upcoming");
    expect(flow.stage3).toBe("upcoming");
  });

  it("todas las revisiones aprobadas completan la etapa 1 y activan la etapa 2", () => {
    const flow = deriveEvaluationFlow(buildData({
      areas: {
        sponsors: { status: "APPROVED", approvedCount: 2, requiredCount: 2 },
        associates: { status: "APPROVED" },
        logistics: { status: "APPROVED" },
        board: { status: "PENDING" },
        payment: { status: "PENDING" },
      },
    }));
    expect(flow.stage1).toBe("completed");
    expect(flow.stage2).toBe("active");
    expect(flow.stage3).toBe("upcoming");
  });

  it("directorio aprobado completa la etapa 2", () => {
    const flow = deriveEvaluationFlow(buildData({
      areas: {
        sponsors: { status: "APPROVED", approvedCount: 2, requiredCount: 2 },
        associates: { status: "APPROVED" },
        logistics: { status: "APPROVED" },
        board: { status: "APPROVED" },
        payment: { status: "PENDING" },
      },
    }));
    expect(flow.stage1).toBe("completed");
    expect(flow.stage2).toBe("completed");
    expect(flow.stage3).toBe("upcoming");
  });

  it("READY_FOR_PAYMENT activa la etapa de pago", () => {
    const flow = deriveEvaluationFlow(buildData({ status: "READY_FOR_PAYMENT" }));
    expect(flow.stage1).toBe("completed");
    expect(flow.stage2).toBe("completed");
    expect(flow.stage3).toBe("active");
  });

  it("COMPLETED marca todas las etapas como completadas", () => {
    const flow = deriveEvaluationFlow(buildData({ status: "COMPLETED" }));
    expect(flow.stage1).toBe("completed");
    expect(flow.stage2).toBe("completed");
    expect(flow.stage3).toBe("completed");
  });
});

describe("areaStatusLabel", () => {
  it.each([
    ["APPROVED", "Aprobado"],
    ["PENDING", "Pendiente"],
    ["OBSERVED", "Observado"],
    ["UNDER_EVALUATION", "En evaluación"],
    ["RESOLVED", "Subsanado"],
    ["REJECTED", "Rechazado"],
  ])("mapea %s → %s", (status, label) => {
    expect(areaStatusLabel(status)).toBe(label);
  });
});

describe("formatRegistrationDate", () => {
  it("formatea la fecha en español", () => {
    expect(formatRegistrationDate("2026-09-23T12:00:00.000Z")).toContain("septiembre");
  });

  it("devuelve guion para fechas ausentes o inválidas", () => {
    expect(formatRegistrationDate(undefined)).toBe("—");
    expect(formatRegistrationDate("no-es-fecha")).toBe("—");
  });
});
