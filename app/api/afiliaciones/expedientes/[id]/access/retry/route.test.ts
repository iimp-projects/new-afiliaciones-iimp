import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  requirePermission: vi.fn(),
  retryProvisioning: vi.fn(),
}));

vi.mock("@/modules/auth/context/service", () => ({
  contextService: {
    requireAuth: mocks.requireAuth,
    requirePermission: mocks.requirePermission,
  },
}));

vi.mock("@/modules/afiliaciones/asociados/Services/AssociateAccessService", () => ({
  AssociateAccessError: class AssociateAccessError extends Error {
    constructor(message: string, readonly status = 409) {
      super(message);
    }
  },
  associateAccessService: { retryProvisioning: mocks.retryProvisioning },
}));

import { POST } from "./route";

describe("portal access retry route", () => {
  const context = { params: Promise.resolve({ id: "10" }) };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuth.mockResolvedValue({ id: 1, role: { slug: "SUPER_ADMIN" } });
    mocks.requirePermission.mockResolvedValue(undefined);
    mocks.retryProvisioning.mockResolvedValue({ status: "PENDING_ACTIVATION" });
  });

  it("keeps update:memberships mandatory before invoking portal-access management", async () => {
    await POST(new Request("http://localhost"), context);

    expect(mocks.requirePermission).toHaveBeenCalledWith("update", "memberships");
    expect(mocks.retryProvisioning).toHaveBeenCalledWith(10, 1);
  });

  it("does not invoke the service when the existing permission check rejects the request", async () => {
    mocks.requirePermission.mockRejectedValue(new Error("Forbidden"));

    const response = await POST(new Request("http://localhost"), context);

    expect(response.status).toBe(500);
    expect(mocks.retryProvisioning).not.toHaveBeenCalled();
  });
});
