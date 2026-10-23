import { describe, expect, it } from "vitest";
import { sponsorEligibilityWhere } from "./SponsorEligibility";

type MockPerson = {
  documentNumber: string;
  user: { type: string; status: string; deletedAt: string | null } | null;
  applications: {
    status: string;
    affiliateType: string;
    deletedAt: string | null;
    payments: { status: string }[];
  }[];
};

/**
 * Evaluador mínimo (espejo del filtro Prisma) para validar la SEMÁNTICA de la
 * regla sobre objetos de ejemplo. No sustituye a Prisma; documenta qué acepta
 * y qué rechaza la regla compartida por validación y guardado.
 */
function matches(person: MockPerson): boolean {
  const where = sponsorEligibilityWhere(person.documentNumber) as {
    documentNumber: string;
    OR: {
      applications?: {
        some: {
          status: string;
          affiliateType: string;
          deletedAt: string | null;
          payments: { some: { status: string } };
        };
      };
      user?: { is: { type: string; status: string; deletedAt: string | null } };
    }[];
  };

  if (person.documentNumber !== where.documentNumber) return false;

  return where.OR.some((condition) => {
    if (condition.applications) {
      const expected = condition.applications.some;
      return (person.applications ?? []).some(
        (application) =>
          application.status === expected.status &&
          application.affiliateType === expected.affiliateType &&
          application.deletedAt === expected.deletedAt &&
          (application.payments ?? []).some((payment) => payment.status === expected.payments.some.status),
      );
    }
    if (condition.user) {
      if (!person.user) return false;
      const is = condition.user.is;
      return Object.entries(is).every(([key, value]) => (person.user as Record<string, unknown>)[key] === value);
    }
    return false;
  });
}

describe("sponsorEligibilityWhere — regla única de aval elegible", () => {
  it("expone una sola regla OR que combina flujo nuevo e histórico", () => {
    const where = sponsorEligibilityWhere("12345678") as Record<string, unknown>;

    expect(where.documentNumber).toBe("12345678");
    const or = where.OR as Array<Record<string, unknown>>;
    expect(or).toHaveLength(2);
    expect(or[0].applications).toBeDefined();
    expect(or[1].user).toBeDefined();
  });

  it("conserva la condición A del flujo nuevo (COMPLETED + ACTIVE + PAID + no eliminado)", () => {
    const where = sponsorEligibilityWhere("12345678") as {
      OR: Array<{ applications?: { some: Record<string, unknown> } }>;
    };
    expect(where.OR[0].applications?.some).toEqual({
      status: "COMPLETED",
      affiliateType: "ACTIVE",
      deletedAt: null,
      payments: { some: { status: "PAID" } },
    });
  });

  it("agrega la condición B de asociado histórico (AFFILIATE + ACTIVE + no eliminado)", () => {
    const where = sponsorEligibilityWhere("12345678") as {
      OR: Array<{ user?: { is: Record<string, unknown> } }>;
    };
    expect(where.OR[1].user?.is).toEqual({
      type: "AFFILIATE",
      status: "ACTIVE",
      deletedAt: null,
    });
  });

  it("acepta un asociado histórico AFFILIATE + ACTIVE sin postulación", () => {
    expect(
      matches({
        documentNumber: "12345678",
        user: { type: "AFFILIATE", status: "ACTIVE", deletedAt: null },
        applications: [],
      }),
    ).toBe(true);
  });

  it("acepta un asociado nuevo con COMPLETED + ACTIVE + PAID", () => {
    expect(
      matches({
        documentNumber: "12345678",
        user: null,
        applications: [
          {
            status: "COMPLETED",
            affiliateType: "ACTIVE",
            deletedAt: null,
            payments: [{ status: "PAID" }],
          },
        ],
      }),
    ).toBe(true);
  });

  it("rechaza un usuario INACTIVE que no cumple otra condición válida", () => {
    expect(
      matches({
        documentNumber: "12345678",
        user: { type: "AFFILIATE", status: "INACTIVE", deletedAt: null },
        applications: [],
      }),
    ).toBe(false);
  });

  it("rechaza un usuario suspendido (BLOCKED) que no cumple otra condición válida", () => {
    expect(
      matches({
        documentNumber: "12345678",
        user: { type: "AFFILIATE", status: "BLOCKED", deletedAt: null },
        applications: [],
      }),
    ).toBe(false);
  });

  it("rechaza un usuario eliminado aunque sea AFFILIATE + ACTIVE", () => {
    expect(
      matches({
        documentNumber: "12345678",
        user: { type: "AFFILIATE", status: "ACTIVE", deletedAt: "2026-10-23T00:00:00.000Z" },
        applications: [],
      }),
    ).toBe(false);
  });

  it("rechaza una persona sin condición de asociado elegible", () => {
    expect(
      matches({
        documentNumber: "12345678",
        user: null,
        applications: [
          {
            status: "PENDING",
            affiliateType: "ACTIVE",
            deletedAt: null,
            payments: [{ status: "PAID" }],
          },
        ],
      }),
    ).toBe(false);
  });

  it("es determinista (misma entrada → misma regla) para validación y guardado", () => {
    expect(sponsorEligibilityWhere("12345678")).toEqual(sponsorEligibilityWhere("12345678"));
  });
});
