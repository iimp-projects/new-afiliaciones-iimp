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
    user?: { is: { type: string; status: string; deletedAt: string | null } };
  };

  if (person.documentNumber !== where.documentNumber) return false;
  if (!where.user || !person.user) return false;

  const is = where.user.is;
  return Object.entries(is).every(
    ([key, value]) => (person.user as Record<string, unknown>)[key] === value,
  );
}

describe("sponsorEligibilityWhere — regla única de aval elegible", () => {
  it("expone una sola regla basada en usuario AFFILIATE + ACTIVE + no eliminado", () => {
    const where = sponsorEligibilityWhere("12345678") as Record<string, unknown>;

    expect(where.documentNumber).toBe("12345678");
    expect(where.OR).toBeUndefined();
    expect(where.user).toEqual({
      is: {
        type: "AFFILIATE",
        status: "ACTIVE",
        deletedAt: null,
      },
    });
  });

  it("acepta un asociado AFFILIATE + ACTIVE sin postulación ni pago", () => {
    expect(
      matches({
        documentNumber: "12345678",
        user: { type: "AFFILIATE", status: "ACTIVE", deletedAt: null },
        applications: [],
      }),
    ).toBe(true);
  });

  it("acepta un asociado AFFILIATE + ACTIVE aunque tenga postulación PENDING", () => {
    expect(
      matches({
        documentNumber: "12345678",
        user: { type: "AFFILIATE", status: "ACTIVE", deletedAt: null },
        applications: [
          {
            status: "PENDING",
            affiliateType: "ACTIVE",
            deletedAt: null,
            payments: [],
          },
        ],
      }),
    ).toBe(true);
  });

  it("rechaza un usuario INACTIVE", () => {
    expect(
      matches({
        documentNumber: "12345678",
        user: { type: "AFFILIATE", status: "INACTIVE", deletedAt: null },
        applications: [],
      }),
    ).toBe(false);
  });

  it("rechaza un usuario suspendido (BLOCKED)", () => {
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

  it("rechaza una persona sin usuario vinculado aunque tenga postulación COMPLETED + PAID", () => {
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
    ).toBe(false);
  });

  it("rechaza un usuario que no es AFFILIATE aunque esté ACTIVE", () => {
    expect(
      matches({
        documentNumber: "12345678",
        user: { type: "VALIDATOR", status: "ACTIVE", deletedAt: null },
        applications: [],
      }),
    ).toBe(false);
  });

  it("rechaza una persona sin usuario (DNI inexistente / sin cuenta)", () => {
    expect(
      matches({
        documentNumber: "12345678",
        user: null,
        applications: [],
      }),
    ).toBe(false);
  });

  it("es determinista (misma entrada → misma regla) para validación y guardado", () => {
    expect(sponsorEligibilityWhere("12345678")).toEqual(sponsorEligibilityWhere("12345678"));
  });
});
