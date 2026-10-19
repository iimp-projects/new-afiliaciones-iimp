import { describe, expect, it, vi } from "vitest";
import { AffiliateType, ApplicationStatus, SieLinkStatus, UserStatus, UserType, type PrismaClient } from "@prisma/client";
import { AssociateRecipientRepository } from "./AssociateRecipientRepository";

type MockFn = ReturnType<typeof vi.fn>;

interface MockDb {
  $queryRawUnsafe: MockFn;
  user: { count: MockFn; findMany: MockFn };
  membershipApplication: { findMany: MockFn };
  sieAssociateRecord: { findMany: MockFn };
}

function mockDb(): MockDb {
  return {
    $queryRawUnsafe: vi.fn(),
    user: { count: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
    membershipApplication: { findMany: vi.fn().mockResolvedValue([]) },
    sieAssociateRecord: { findMany: vi.fn().mockResolvedValue([]) },
  };
}

function sieRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    linkStatus: SieLinkStatus.LINKED,
    personId: 10,
    documentNumber: "12345678",
    externalCode: "C1",
    category: { allowsLogin: true },
    person: {
      firstName: "Juan",
      paternalLastName: "PÃ©rez",
      maternalLastName: null,
      contacts: [{ email: "juan@x.com" }],
      user: null,
    },
    ...overrides,
  };
}

describe("AssociateRecipientRepository.countEligibleValid", () => {
  it("devuelve el conteo real de correos vÃ¡lidos", async () => {
    const db = mockDb();
    db.$queryRawUnsafe.mockResolvedValue([{ count: 3361 }]);
    const repo = new AssociateRecipientRepository(db as unknown as PrismaClient);
    const result = await repo.countEligibleValid("ALL");
    expect(result).toBe(3361);
    expect(db.$queryRawUnsafe).toHaveBeenCalledWith(expect.stringContaining("ASOCIADO_ACTIVO"));
    expect(db.$queryRawUnsafe).toHaveBeenCalledWith(expect.stringContaining("ASOCIADO_ESTUDIANTE"));
  });
});

describe("AssociateRecipientRepository.listExcluded", () => {
  it("separa categorÃ­as SIE no-login como no-asociados", async () => {
    const db = mockDb();
    db.sieAssociateRecord.findMany.mockResolvedValue([
      sieRecord({ id: 1, linkStatus: SieLinkStatus.LINKED, category: { allowsLogin: false }, person: { ...sieRecord().person, user: null } }),
      sieRecord({ id: 2, linkStatus: SieLinkStatus.CONFLICT, category: { allowsLogin: false }, person: null }),
      sieRecord({ id: 3, linkStatus: SieLinkStatus.UNLINKED, category: { allowsLogin: false }, person: null }),
    ]);
    const repo = new AssociateRecipientRepository(db as unknown as PrismaClient);
    const result = await repo.listExcluded("ALL");
    expect(result.nonAssociate).toBe(3);
    expect(result.total).toBe(0);
  });

  it("cuenta categorÃ­as SIE login sin cuenta como NO_ACCOUNT (asociado a revisar)", async () => {
    const db = mockDb();
    db.sieAssociateRecord.findMany.mockResolvedValue([
      sieRecord({ id: 1, linkStatus: SieLinkStatus.LINKED, category: { allowsLogin: true }, person: { ...sieRecord().person, user: null } }),
    ]);
    const repo = new AssociateRecipientRepository(db as unknown as PrismaClient);
    const result = await repo.listExcluded("ALL");
    expect(result.total).toBe(1);
    expect(result.byReason.NO_ACCOUNT).toBe(1);
    expect(result.nonAssociate).toBe(0);
  });

  it("respeta el filtro de membresÃ­a en postulaciones", async () => {
    const db = mockDb();
    db.membershipApplication.findMany.mockResolvedValue([]);
    const repo = new AssociateRecipientRepository(db as unknown as PrismaClient);
    await repo.listExcluded("ACTIVE");
    expect(db.membershipApplication.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ affiliateType: { in: [AffiliateType.ACTIVE] } }) }),
    );
  });

  it("cuenta postulaciones COMPLETED sin cuenta como NO_ACCOUNT", async () => {
    const db = mockDb();
    db.membershipApplication.findMany.mockResolvedValue([
      {
        email: "a@x.com",
        person: {
          id: 10,
          documentNumber: "1",
          firstName: "A",
          paternalLastName: "B",
          maternalLastName: null,
          contacts: [{ email: "a@x.com" }],
          user: null,
        },
      },
    ]);
    const repo = new AssociateRecipientRepository(db as unknown as PrismaClient);
    const result = await repo.listExcluded("ALL");
    expect(result.total).toBe(1);
    expect(result.byReason.NO_ACCOUNT).toBe(1);
    expect(db.membershipApplication.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: ApplicationStatus.COMPLETED }) }),
    );
  });
});
