import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireApiPermission: vi.fn(),
  sendManual: vi.fn(),
}));

vi.mock("@/modules/auth/context/api-authorization", () => ({
  requireApiPermission: mocks.requireApiPermission,
  apiAuthorizationStatus: (error: unknown, fallback = 500) => {
    const status = (error as { status?: unknown } | null)?.status;
    return typeof status === "number" ? status : fallback;
  },
}));

vi.mock("@/modules/afiliaciones/payments/Services/IncorporationPaymentRequestEmailService", () => ({
  IncorporationPaymentRequestEmailService: class {
    public sendManual = mocks.sendManual;
  },
}));

import { POST } from "./route";

const params = Promise.resolve({ id: "7" });
const request = new NextRequest("http://localhost/api/afiliaciones/expedientes/7/enviar-metodos-pago", { method: "POST" });

function userWithRole(roleSlug: string) {
  return { id: 10, role: { slug: roleSlug }, person: { firstName: "Ana", paternalLastName: "Pérez" } };
}

describe("POST /api/afiliaciones/expedientes/[id]/enviar-metodos-pago", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireApiPermission.mockResolvedValue(userWithRole("ATENCION_ASOCIADO"));
    mocks.sendManual.mockResolvedValue({ sent: true });
  });

  it("permite a Atención al Asociado enviar los métodos de pago", async () => {
    const response = await POST(request, { params });

    expect(response.status).toBe(200);
    expect(mocks.requireApiPermission).toHaveBeenCalledWith("update", "applications");
    expect(mocks.sendManual).toHaveBeenCalledWith(7);
    expect(await response.json()).toMatchObject({ success: true });
  });

  it.each(["SUPER_ADMIN", "SYSTEM_ADMIN"] as const)("permite a %s", async (roleSlug) => {
    mocks.requireApiPermission.mockResolvedValue(userWithRole(roleSlug));
    const response = await POST(request, { params });
    expect(response.status).toBe(200);
    expect(mocks.sendManual).toHaveBeenCalledOnce();
  });

  it.each(["LOGISTICA", "LEGAL", "COMUNICACIONES", "COMITE_EVALUADOR"] as const)(
    "oculta y bloquea la acción para %s",
    async (roleSlug) => {
      mocks.requireApiPermission.mockResolvedValue(userWithRole(roleSlug));
      const response = await POST(request, { params });
      expect(response.status).toBe(403);
      expect(mocks.sendManual).not.toHaveBeenCalled();
    },
  );

  it("no envía cuando el expediente no está apto para pago", async () => {
    mocks.sendManual.mockResolvedValue({ sent: false, reason: "NOT_READY_FOR_PAYMENT" });

    const response = await POST(request, { params });

    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain("Apto para Pago");
  });

  it("mantiene el 401/403 de la capa de autorización", async () => {
    mocks.requireApiPermission.mockRejectedValue(Object.assign(new Error("No autenticado."), { status: 401 }));
    const response = await POST(request, { params });
    expect(response.status).toBe(401);
    expect(mocks.sendManual).not.toHaveBeenCalled();
  });
});
