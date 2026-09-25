import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireApiPermission: vi.fn(),
  getById: vi.fn(),
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
    getById = mocks.getById;
  },
}));

import { GET } from "./route";

describe("expediente detail route — autorización por recurso", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireApiPermission.mockResolvedValue({ id: 1, role: { slug: "LOGISTICA" } });
    mocks.getById.mockResolvedValue({ id: 1, applicationCode: "APP-1" });
  });

  it("exige read:applications (no read:memberships) para leer el detalle", async () => {
    const context = { params: Promise.resolve({ id: "1" }) };
    const response = await GET(new NextRequest("http://localhost/api/afiliaciones/expedientes/1"), context);
    expect(mocks.requireApiPermission).toHaveBeenCalledWith("read", "applications");
    expect(response.status).toBe(200);
  });

  it("devuelve 403 cuando el usuario no tiene read:applications", async () => {
    mocks.requireApiPermission.mockRejectedValue({ status: 403 });
    const context = { params: Promise.resolve({ id: "1" }) };
    const response = await GET(new NextRequest("http://localhost/api/afiliaciones/expedientes/1"), context);
    expect(response.status).toBe(403);
    expect(mocks.getById).not.toHaveBeenCalled();
  });
});
