import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getCurrentUser: vi.fn(), requireRole: vi.fn(), recover: vi.fn() }));

vi.mock("@/modules/auth/context/service", () => ({ contextService: { getCurrentUser: mocks.getCurrentUser, requireRole: mocks.requireRole } }));
vi.mock("@/modules/afiliaciones/associates-integration/Services/AssociatesIntegrationService", () => ({ AssociatesIntegrationService: class { recoverPreDispatchFailure = mocks.recover; } }));

import { POST } from "./route";

describe("recover pre-dispatch route", () => {
  const context = { params: Promise.resolve({ id: "5" }) };
  beforeEach(() => { vi.clearAllMocks(); mocks.getCurrentUser.mockResolvedValue({ id: 7 }); mocks.requireRole.mockResolvedValue(undefined); mocks.recover.mockResolvedValue({ id: 5, previousStatus: "FAILED", status: "RETRYABLE", reconciliation: "ABSENT" }); });

  it("requires SUPER_ADMIN and exposes only the safe recovery result", async () => {
    const response = await POST(new Request("http://localhost"), context);
    expect(mocks.requireRole).toHaveBeenCalledWith(["SUPER_ADMIN"]);
    expect(mocks.recover).toHaveBeenCalledWith(5, 7);
    await expect(response.json()).resolves.toEqual({ success: true, data: { id: 5, previousStatus: "FAILED", status: "RETRYABLE", reconciliation: "ABSENT" } });
  });

  it("does not invoke recovery without an authenticated user", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    const response = await POST(new Request("http://localhost"), context);
    expect(response.status).toBe(401);
    expect(mocks.recover).not.toHaveBeenCalled();
  });

  it("returns a sanitized backend rejection without retrying", async () => {
    mocks.recover.mockRejectedValue(Object.assign(new Error("La integración no cumple las condiciones para recuperación pre-despacho."), { status: 409 }));
    const response = await POST(new Request("http://localhost"), context);
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ success: false, message: "La integración no cumple las condiciones para recuperación pre-despacho." });
    expect(mocks.recover).toHaveBeenCalledTimes(1);
  });
});
