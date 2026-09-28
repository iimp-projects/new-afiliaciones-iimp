import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requirePermission: vi.fn(), getByApplicationId: vi.fn() }));
vi.mock("@/modules/auth/context/service", () => ({ contextService: { requirePermission: mocks.requirePermission } }));
vi.mock("@/modules/afiliaciones/asociados/Services/AssociateSieProfileService", () => ({
  AssociateSieProfileError: class AssociateSieProfileError extends Error { constructor(message: string, readonly status: 404 | 422) { super(message); } },
  associateSieProfileService: { getByApplicationId: mocks.getByApplicationId },
}));
vi.mock("@/modules/afiliaciones/associates-integration/Clients/AssociatesApiError", () => ({ AssociatesApiError: class AssociatesApiError extends Error {} }));

import { GET } from "./route";

describe("associate SIE state route", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.requirePermission.mockResolvedValue(undefined); mocks.getByApplicationId.mockResolvedValue({ registered: false, checkedAt: "2026-02-01T10:00:00.000Z" }); });
  it("requires the same read:memberships permission as the associate directory and only forwards the internal id", async () => {
    const response = await GET(new Request("http://localhost/api/afiliaciones/asociados/12/sie"), { params: Promise.resolve({ id: "12" }) });
    expect(response.status).toBe(200);
    expect(mocks.requirePermission).toHaveBeenCalledWith("read", "memberships");
    expect(mocks.getByApplicationId).toHaveBeenCalledWith(12);
    expect(await response.json()).toEqual({ success: true, data: { registered: false, checkedAt: "2026-02-01T10:00:00.000Z" } });
  });
  it("does not reach the SIE service when internal authorization fails", async () => {
    mocks.requirePermission.mockRejectedValue(new Error("denied"));
    const response = await GET(new Request("http://localhost"), { params: Promise.resolve({ id: "12" }) });
    expect(response.status).toBe(403);
    expect(mocks.getByApplicationId).not.toHaveBeenCalled();
  });
});
