import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  getDashboardData: vi.fn(),
  getAreaActivityMetrics: vi.fn(),
}));
vi.mock("@/modules/auth/context/service", () => ({ contextService: {
  requirePermission: mocks.requirePermission,
} }));
vi.mock("../Services/DashboardService", () => ({ DashboardService: { getDashboardData: mocks.getDashboardData } }));
vi.mock("../Services/AreaActivityService", () => ({
  AreaActivityService: class { getAreaActivityMetrics = mocks.getAreaActivityMetrics; },
}));

import { fetchDashboardStats } from "./dashboard.actions";
import { fetchAreaActivityAction } from "./area-activity.actions";

describe("dashboard Server Action authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires read:dashboard before loading dashboard data", async () => {
    mocks.requirePermission.mockRejectedValue(new Error("denied"));

    await expect(fetchDashboardStats()).resolves.toMatchObject({ success: false });
    expect(mocks.requirePermission).toHaveBeenCalledWith("read", "dashboard");
    expect(mocks.getDashboardData).not.toHaveBeenCalled();
  });

  it("requires read:dashboard before loading area activity", async () => {
    mocks.requirePermission.mockRejectedValue(new Error("denied"));

    await expect(fetchAreaActivityAction({ areaFilter: "Legal", periodFilter: "Hoy", aggregation: "Diario" })).resolves.toMatchObject({ success: false });
    expect(mocks.requirePermission).toHaveBeenCalledWith("read", "dashboard");
    expect(mocks.getAreaActivityMetrics).not.toHaveBeenCalled();
  });

  it("loads dashboard data only after the permission returns the authorized user", async () => {
    mocks.requirePermission.mockResolvedValue({ role: { id: 2, slug: "LEGAL" } });
    mocks.getDashboardData.mockResolvedValue({ kpis: {} });

    await expect(fetchDashboardStats()).resolves.toMatchObject({ success: true });
    expect(mocks.getDashboardData).toHaveBeenCalledWith(2, "LEGAL");
  });
});
