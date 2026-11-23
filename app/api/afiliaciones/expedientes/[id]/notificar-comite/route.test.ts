import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireApiPermission: vi.fn(),
  execute: vi.fn(),
}));

vi.mock("@/modules/auth/context/api-authorization", () => ({
  requireApiPermission: mocks.requireApiPermission,
  apiAuthorizationStatus: (error: unknown, fallback = 500) => {
    const status = (error as { status?: unknown } | null)?.status;
    return typeof status === "number" ? status : fallback;
  },
}));

vi.mock("@/modules/afiliaciones/expedientes/Services/NotifyComiteService", () => ({
  NotifyComiteService: class {
    public execute = mocks.execute;
  },
}));

import { POST } from "./route";

function request(body: Record<string, unknown> = { targetUserId: "ALL" }) {
  return new NextRequest("http://localhost/api/afiliaciones/expedientes/7/notificar-comite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const params = Promise.resolve({ id: "7" });

describe("POST /api/afiliaciones/expedientes/[id]/notificar-comite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireApiPermission.mockResolvedValue({
      id: 10,
      role: { slug: "ATENCION_ASOCIADO" },
      person: { firstName: "Ana", paternalLastName: "Pérez" },
    });
    mocks.execute.mockResolvedValue(undefined);
  });

  it("exige update:applications y permite a ATENCION_ASOCIADO notificar al comité", async () => {
    const response = await POST(request({ targetUserId: "5" }), { params });

    expect(response.status).toBe(200);
    expect(mocks.requireApiPermission).toHaveBeenCalledWith("update", "applications");
    expect(mocks.execute).toHaveBeenCalledWith(7, true, 5, 10, "Ana Pérez");
    expect(await response.json()).toMatchObject({ success: true });
  });

  it("no exige update:memberships", async () => {
    await POST(request(), { params });
    expect(mocks.requireApiPermission).not.toHaveBeenCalledWith("update", "memberships");
  });

  it.each(["SUPER_ADMIN", "SYSTEM_ADMIN"] as const)("permite a %s aunque el rol no sea Atención al Asociado", async (roleSlug) => {
    mocks.requireApiPermission.mockResolvedValue({
      id: 10,
      role: { slug: roleSlug },
      person: { firstName: "Ana", paternalLastName: "Pérez" },
    });

    const response = await POST(request(), { params });

    expect(response.status).toBe(200);
    expect(mocks.execute).toHaveBeenCalledTimes(1);
  });

  it("oculta y bloquea la acción para otros roles internos", async () => {
    mocks.requireApiPermission.mockResolvedValue({
      id: 10,
      role: { slug: "LOGISTICA" },
      person: { firstName: "Ana", paternalLastName: "Pérez" },
    });

    const response = await POST(request(), { params });

    expect(response.status).toBe(403);
    expect(mocks.execute).not.toHaveBeenCalled();
  });

  it("rechaza con 403 a un rol sin update:applications (por ejemplo COMITE_EVALUADOR)", async () => {
    mocks.requireApiPermission.mockRejectedValue(Object.assign(new Error("No autorizado."), { status: 403 }));

    const response = await POST(request(), { params });

    expect(response.status).toBe(403);
    expect(mocks.execute).not.toHaveBeenCalled();
    expect(await response.json()).toMatchObject({ success: false });
  });

  it("no llama al servicio si el expediente no tiene las aprobaciones previas", async () => {
    mocks.execute.mockRejectedValue(
      new Error("El expediente aún no tiene todas las aprobaciones previas (Logística, Asociados y Avales)."),
    );

    const response = await POST(request(), { params });

    expect(response.status).toBe(500);
    expect(mocks.execute).toHaveBeenCalledTimes(1);
  });
});
