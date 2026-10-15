import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  appFindMany: vi.fn(),
  appCount: vi.fn(),
  sieFindMany: vi.fn(),
  sieCount: vi.fn(),
}));

vi.mock("@/modules/auth/context/service", () => ({
  contextService: { requirePermission: mocks.requirePermission },
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    membershipApplication: {
      findMany: mocks.appFindMany,
      count: mocks.appCount,
    },
    sieAssociateRecord: {
      findMany: mocks.sieFindMany,
      count: mocks.sieCount,
    },
  },
}));
vi.mock("@/modules/shared/Services/S3StorageService", () => ({
  S3StorageService: class {
    async getPresignedApplicationDocumentUrl() {
      return "https://presigned.example";
    }
  },
}));

import { fetchAsociadosAction } from "../Actions/asociados.actions";

function sieWhereForLastCall() {
  return (mocks.sieCount.mock.calls.at(-1)?.[0] as { where?: Record<string, unknown> })?.where ?? {};
}

describe("fetchAsociadosAction — gate del directorio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue(undefined);
    mocks.appFindMany.mockResolvedValue([]);
    mocks.appCount.mockResolvedValue(0);
    mocks.sieFindMany.mockResolvedValue([]);
    mocks.sieCount.mockResolvedValue(0);
  });

  it("exige read:associates (no read:memberships) para listar el directorio", async () => {
    const result = await fetchAsociadosAction({ page: 1, pageSize: 12 });

    expect(mocks.requirePermission).toHaveBeenCalledWith("read", "associates");
    expect(mocks.requirePermission).not.toHaveBeenCalledWith("read", "memberships");
    expect(result).toMatchObject({ success: true, data: [], total: 0 });
  });

  it("permite el listado a un rol con read:associates (COMITÉ) y lo bloquea si se deniega el permiso", async () => {
    mocks.requirePermission.mockResolvedValue(undefined);
    await expect(fetchAsociadosAction({})).resolves.toMatchObject({ success: true });

    mocks.requirePermission.mockRejectedValue(new Error("Permiso denegado"));
    await expect(fetchAsociadosAction({})).resolves.toMatchObject({ success: false });
  });

  it("mantiene los filtros de elegibilidad histórica siempre como AND", async () => {
    await fetchAsociadosAction({});
    const where = sieWhereForLastCall();

    expect(where.provider).toBe("SIE");
    expect(where.linkStatus).toBe("LINKED");
    expect(where.category).toMatchObject({ mappedAffiliateType: { not: null } });
    expect(where.person).toMatchObject({
      deletedAt: null,
      applications: { none: { status: "COMPLETED", deletedAt: null } },
    });
    expect(where.OR).toBeUndefined();
  });

  it("compone la búsqueda histórica con OR (código, DNI, nombres), no con AND", async () => {
    await fetchAsociadosAction({ search: "08200623" });
    const where = sieWhereForLastCall();

    // El bug previo ponía externalCode como AND directo y el search dentro de person.OR.
    expect(where.externalCode).toBeUndefined();
    expect(where.OR).toBeDefined();
    const or = where.OR as Record<string, unknown>[];
    expect(or).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ externalCode: expect.objectContaining({ contains: "08200623" }) }),
        expect.objectContaining({ person: expect.objectContaining({ documentNumber: expect.objectContaining({ contains: "08200623" }) }) }),
        expect.objectContaining({ person: expect.objectContaining({ firstName: expect.objectContaining({ contains: "08200623" }) }) }),
        expect.objectContaining({ person: expect.objectContaining({ paternalLastName: expect.objectContaining({ contains: "08200623" }) }) }),
        expect.objectContaining({ person: expect.objectContaining({ maternalLastName: expect.objectContaining({ contains: "08200623" }) }) }),
      ])
    );
  });

  it("la búsqueda por código institucional se resuelve por OR sin exigir coincidencia en persona", async () => {
    await fetchAsociadosAction({ search: "00225" });
    const where = sieWhereForLastCall();
    const or = where.OR as Record<string, unknown>[];
    expect(or).toEqual(expect.arrayContaining([expect.objectContaining({ externalCode: expect.objectContaining({ contains: "00225" }) })]));
    expect(where.externalCode).toBeUndefined();
  });
});
