import { describe, expect, it } from "vitest";
import { sponsorEligibilityWhere } from "./SponsorEligibility";

describe("sponsorEligibilityWhere — regla única de aval elegible", () => {
  it("exige DNI exacto + COMPLETED + ACTIVO + PAGADO + no eliminado", () => {
    const where = sponsorEligibilityWhere("12345678") as Record<string, unknown>;

    expect(where.documentNumber).toBe("12345678");
    expect(where.user).toBeUndefined();

    const applications = where.applications as { some: Record<string, unknown> };
    expect(applications.some).toEqual({
      status: "COMPLETED",
      affiliateType: "ACTIVE",
      deletedAt: null,
      payments: { some: { status: "PAID" } },
    });
  });

  it("no exige auth_user ni role ni type ni status de usuario", () => {
    const where = sponsorEligibilityWhere("12345678") as Record<string, unknown>;
    expect(where).not.toHaveProperty("user");
    expect(JSON.stringify(where)).not.toContain("AFFILIATE");
    expect(JSON.stringify(where)).not.toContain("ASOCIADO_ACTIVO");
    expect(JSON.stringify(where)).not.toContain("role");
    expect(JSON.stringify(where)).not.toContain("type");
  });
});
