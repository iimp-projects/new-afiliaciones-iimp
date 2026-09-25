import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireApiPermission: vi.fn(),
}));

vi.mock("@/modules/auth/context/api-authorization", () => ({
  requireApiPermission: mocks.requireApiPermission,
  apiAuthorizationStatus: (error: unknown, fallback = 500) => {
    const e = error as { status?: number } | null;
    return typeof e === "object" && e !== null && typeof e.status === "number" ? e.status : fallback;
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: vi.fn() } }));

import { PATCH } from "./route";

const makeRequest = (body: Record<string, unknown>) =>
  new NextRequest("http://localhost/api/afiliaciones/expedientes/1/status", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const context = { params: Promise.resolve({ id: "1" }) };

describe("status route — autorización dinámica fail-closed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rechaza RESOLVED sin autorizar (fail-closed)", async () => {
    const res = await PATCH(makeRequest({ newStatus: "RESOLVED" }), context);
    expect(res.status).toBe(400);
    expect(mocks.requireApiPermission).not.toHaveBeenCalled();
  });

  it("rechaza estado desconocido (fail-closed)", async () => {
    const res = await PATCH(makeRequest({ newStatus: "INVALID_STATUS" }), context);
    expect(res.status).toBe(400);
    expect(mocks.requireApiPermission).not.toHaveBeenCalled();
  });

  it("rechaza newStatus que no es string (fail-closed)", async () => {
    const res = await PATCH(makeRequest({ newStatus: 123 }), context);
    expect(res.status).toBe(400);
    expect(mocks.requireApiPermission).not.toHaveBeenCalled();
  });

  it("exige observe:applications para OBSERVED", async () => {
    mocks.requireApiPermission.mockRejectedValue({ status: 403 });
    const res = await PATCH(makeRequest({ newStatus: "OBSERVED" }), context);
    expect(mocks.requireApiPermission).toHaveBeenCalledWith("observe", "applications");
    expect(res.status).toBe(403);
  });

  it("exige approve:applications para APPROVED", async () => {
    mocks.requireApiPermission.mockRejectedValue({ status: 403 });
    const res = await PATCH(makeRequest({ newStatus: "APPROVED" }), context);
    expect(mocks.requireApiPermission).toHaveBeenCalledWith("approve", "applications");
    expect(res.status).toBe(403);
  });

  it("exige reject:applications para REJECTED", async () => {
    mocks.requireApiPermission.mockRejectedValue({ status: 403 });
    const res = await PATCH(makeRequest({ newStatus: "REJECTED" }), context);
    expect(mocks.requireApiPermission).toHaveBeenCalledWith("reject", "applications");
    expect(res.status).toBe(403);
  });

  it("exige reopen:applications para PENDING", async () => {
    mocks.requireApiPermission.mockRejectedValue({ status: 403 });
    const res = await PATCH(makeRequest({ newStatus: "PENDING" }), context);
    expect(mocks.requireApiPermission).toHaveBeenCalledWith("reopen", "applications");
    expect(res.status).toBe(403);
  });

  it("propaga 401 cuando no hay sesión activa", async () => {
    mocks.requireApiPermission.mockRejectedValue({ status: 401 });
    const res = await PATCH(makeRequest({ newStatus: "APPROVED" }), context);
    expect(res.status).toBe(401);
  });

  it("bloquea modificar otra área (403)", async () => {
    mocks.requireApiPermission.mockResolvedValue({ id: 1, role: { slug: "LOGISTICA" } });
    const res = await PATCH(
      makeRequest({
        newStatus: "OBSERVED",
        reason: "Falta información",
        fieldPaths: ["personalInformation.phone"],
        targetDepartmentCode: "ASOCIADOS",
      }),
      context,
    );
    expect(res.status).toBe(403);
  });
});
