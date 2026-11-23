import { Gender, UserStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { buildHistoricalWhere, buildV2Where } from "../Services/asociadosQuery";

const advanced = {
  gender: Gender.FEMALE,
  countryId: 1,
  universityId: 12,
  companyId: 34,
  accountStatus: UserStatus.ACTIVE,
  dateFrom: new Date("2026-01-01T00:00:00.000Z"),
  dateTo: new Date("2026-01-31T23:59:59.999Z"),
};

describe("asociadosQuery — filtros avanzados", () => {
  it("mapea los filtros avanzados en la consulta V2", () => {
    const where = buildV2Where("ana", "ACTIVE", advanced);
    expect(where.person).toMatchObject({
      gender: Gender.FEMALE,
      addresses: { some: { countryId: 1 } },
      academicInfos: { some: { universityId: 12 } },
      employmentInfos: { some: { companyId: 34 } },
      user: { status: UserStatus.ACTIVE },
    });
    expect(where.updatedAt).toEqual({ gte: advanced.dateFrom, lte: advanced.dateTo });
    expect(where.affiliateType).toBe("ACTIVE");
  });

  it("mapea los mismos filtros en la consulta histórica", () => {
    const where = buildHistoricalWhere(undefined, "STUDENT", advanced);
    expect(where.person).toMatchObject({
      gender: Gender.FEMALE,
      addresses: { some: { countryId: 1 } },
      academicInfos: { some: { universityId: 12 } },
      employmentInfos: { some: { companyId: 34 } },
      user: { status: UserStatus.ACTIVE },
    });
    expect(where.updatedAt).toEqual({ gte: advanced.dateFrom, lte: advanced.dateTo });
    expect(where.category).toEqual({ code: "E" });
  });

  it("incluye solo categorías vigentes por defecto y todas con includeInactive", () => {
    expect(buildHistoricalWhere().category).toEqual({ code: { in: ["A", "E", "V", "H", "T"] } });
    expect(buildHistoricalWhere(undefined, "ALL", { includeInactive: true }).category).toEqual({ code: { in: ["A", "E", "V", "H", "T", "X", "R", "U", "F"] } });
  });

  it("no agrega filtros cuando no se envían", () => {
    expect(buildV2Where()).not.toHaveProperty("person");
    expect(buildHistoricalWhere().person).toMatchObject({ deletedAt: null });
  });
});
