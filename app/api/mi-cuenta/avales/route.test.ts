import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getForUser: vi.fn(),
}));

vi.mock("@/modules/auth/context/service", () => ({
  contextService: { getCurrentUser: mocks.getCurrentUser },
}));
vi.mock("@/modules/afiliaciones/endorsements/Services/EndorsementHistoryService", () => ({
  EndorsementHistoryService: class {
    getForUser = mocks.getForUser;
  },
}));

import { GET } from "./route";

const affiliate = (overrides: Record<string, unknown> = {}) => ({
  id: 5,
  status: "ACTIVE",
  mustChangePassword: false,
  type: "AFFILIATE",
  role: { slug: "ASOCIADO_ACTIVO" },
  ...overrides,
});

const page = {
  items: [],
  metrics: { total: 0, approved: 0, inProcess: 0 },
  page: 1,
  pageSize: 10,
  totalItems: 0,
  totalPages: 0,
};

const request = (query = "page=1") =>
  new NextRequest(`http://localhost/api/mi-cuenta/avales?${query}`);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getForUser.mockResolvedValue(page);
});

describe("GET /api/mi-cuenta/avales", () => {
  it("rejects requests without an active session", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);

    const response = await GET(request());

    expect(response.status).toBe(403);
    expect(mocks.getForUser).not.toHaveBeenCalled();
  });

  it("rejects administrative (non-affiliate) users", async () => {
    mocks.getCurrentUser.mockResolvedValue(affiliate({ type: "INTERNAL", role: { slug: "ADMIN" } }));

    const response = await GET(request());

    expect(response.status).toBe(403);
    expect(mocks.getForUser).not.toHaveBeenCalled();
  });

  it("rejects affiliates that must change their password", async () => {
    mocks.getCurrentUser.mockResolvedValue(affiliate({ mustChangePassword: true }));

    const response = await GET(request());

    expect(response.status).toBe(403);
    expect(mocks.getForUser).not.toHaveBeenCalled();
  });

  it("returns the authenticated affiliate's own history", async () => {
    mocks.getCurrentUser.mockResolvedValue(affiliate());

    const response = await GET(request("page=2&pageSize=5&status=OBSERVED&search=ana"));

    expect(response.status).toBe(200);
    expect(mocks.getForUser).toHaveBeenCalledWith(5, expect.objectContaining({
      page: 2,
      pageSize: 5,
      status: "OBSERVED",
      search: "ana",
    }));
    await expect(response.json()).resolves.toMatchObject({ success: true, data: page });
  });

  it("rejects invalid filters before hitting the service", async () => {
    mocks.getCurrentUser.mockResolvedValue(affiliate());

    const response = await GET(request("page=0&status=NOT_A_STATUS"));

    expect(response.status).toBe(400);
    expect(mocks.getForUser).not.toHaveBeenCalled();
  });
});
