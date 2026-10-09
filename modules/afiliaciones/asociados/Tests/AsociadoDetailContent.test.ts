import { describe, expect, it } from "vitest";
import { buildAssociateExecutiveSummary } from "../Views/AsociadoDetailContent";

const application = {
  status: "COMPLETED",
  affiliateType: "ACTIVE",
  updatedAt: new Date("2026-10-03T10:00:00.000Z"),
  history: [
    { id: 1, newStatus: "PENDING", createdAt: new Date("2026-08-01T10:00:00.000Z") },
    { id: 2, newStatus: "COMPLETED", createdAt: new Date("2026-09-15T10:00:00.000Z") },
    { id: 3, newStatus: "UNDER_EVALUACION", createdAt: new Date("2026-09-01T10:00:00.000Z"), changeReason: "Validación documentaria" },
    { id: 4, newStatus: "APPROVED", createdAt: new Date("2026-09-10T10:00:00.000Z") },
  ],
};

const user = {
  id: 1,
  status: "ACTIVE",
  updatedAt: new Date("2026-10-02T10:00:00.000Z"),
  role: { slug: "ASOCIADO_ACTIVO", name: "Asociado Activo" },
  person: {
    firstName: "Ana",
    paternalLastName: "Ríos",
    documentType: "DNI",
    documentNumber: "41000057",
    contacts: [],
    professionalExperiences: [],
    applications: [application],
  },
};

describe("buildAssociateExecutiveSummary", () => {
  it("muestra sólo hechos locales y ordena hasta tres eventos reales", () => {
    const summary = buildAssociateExecutiveSummary(user, application, application.history[1], [
      { id: 10, status: "PAID", createdAt: new Date("2026-09-16T10:00:00.000Z") },
    ]);

    expect(summary.membershipStatus).toBe("HÁBIL");
    expect(summary.category).toBe("Asociado Activo");
    expect(summary.verifiedMemberSince).toEqual(application.history[1].createdAt);
    expect(summary.registration).toMatchObject({ label: "Inscripción pagada", tone: "success" });
    expect(summary.recentEvents.map((event) => event.id)).toEqual(["history-2", "history-4", "history-3"]);
    expect(summary.recentEvents).toHaveLength(3);
  });

  it("no infiere cuotas ni fecha de incorporación sin fuentes locales verificables", () => {
    const summary = buildAssociateExecutiveSummary({ ...user, status: "BLOCKED" }, { ...application, history: [] }, undefined, []);

    expect(summary.membershipStatus).toBe("Blocked");
    expect(summary.verifiedMemberSince).toBeNull();
    expect(summary.membershipAge).toBeNull();
    expect(summary.registration).toEqual({ label: "Sin registro local", detail: "No permite inferir cuotas", tone: "neutral" });
    expect(summary.recentEvents).toEqual([]);
  });
});
