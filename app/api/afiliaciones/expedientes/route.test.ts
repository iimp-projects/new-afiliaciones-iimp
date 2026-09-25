import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireApiPermission: vi.fn(),
  getPaginated: vi.fn(),
  toCardData: vi.fn(),
  groupBy: vi.fn(),
}));

vi.mock("@/modules/auth/context/api-authorization", () => ({
  requireApiPermission: mocks.requireApiPermission,
  apiAuthorizationStatus: (error: unknown, fallback = 500) => {
    const e = error as { status?: number } | null;
    return typeof e === "object" && e !== null && typeof e.status === "number" ? e.status : fallback;
  },
}));

vi.mock("@/modules/afiliaciones/expedientes/Repositories/ExpedienteRepository", () => ({
  ExpedienteRepository: class {
    getPaginated = mocks.getPaginated;
  },
}));

vi.mock("@/modules/afiliaciones/expedientes/Mappers/ExpedienteMapper", () => ({
  ExpedienteMapper: { toCardData: mocks.toCardData },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { operationalAlertTracking: { groupBy: mocks.groupBy } },
}));

import { GET } from "./route";

describe("expedientes list route — autorización por recurso", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireApiPermission.mockResolvedValue({ id: 1, role: { slug: "LOGISTICA" } });
    mocks.getPaginated.mockResolvedValue({ data: [], meta: { total: 0, page: 1, pageSize: 8, totalPages: 1 } });
    mocks.groupBy.mockResolvedValue([]);
    mocks.toCardData.mockResolvedValue({});
  });

  it("exige read:applications (no read:memberships) para listar expedientes", async () => {
    const response = await GET(new NextRequest("http://localhost/api/afiliaciones/expedientes"));
    expect(mocks.requireApiPermission).toHaveBeenCalledWith("read", "applications");
    expect(response.status).toBe(200);
  });

  it("devuelve 403 cuando el usuario no tiene read:applications", async () => {
    mocks.requireApiPermission.mockRejectedValue({ status: 403 });
    const response = await GET(new NextRequest("http://localhost/api/afiliaciones/expedientes"));
    expect(response.status).toBe(403);
    expect(mocks.getPaginated).not.toHaveBeenCalled();
  });

  it("no exige read:memberships", async () => {
    await GET(new NextRequest("http://localhost/api/afiliaciones/expedientes"));
    expect(mocks.requireApiPermission).not.toHaveBeenCalledWith("read", "memberships");
  });
});
