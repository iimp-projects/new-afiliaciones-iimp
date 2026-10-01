import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  findMany: vi.fn(),
  count: vi.fn(),
}));

vi.mock("@/modules/auth/context/service", () => ({
  contextService: { requirePermission: mocks.requirePermission },
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    membershipApplication: {
      findMany: mocks.findMany,
      count: mocks.count,
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

describe("fetchAsociadosAction — gate del directorio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue(undefined);
    mocks.findMany.mockResolvedValue([]);
    mocks.count.mockResolvedValue(0);
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
});
