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

  it("exige read:applications antes de cargar los datos del dashboard", async () => {
    mocks.requirePermission.mockRejectedValue(new Error("denied"));

    await expect(fetchDashboardStats()).resolves.toMatchObject({ success: false });
    expect(mocks.requirePermission).toHaveBeenCalledWith("read", "applications");
    expect(mocks.getDashboardData).not.toHaveBeenCalled();
  });

  it("exige read:applications antes de cargar la actividad del área", async () => {
    mocks.requirePermission.mockRejectedValue(new Error("denied"));

    await expect(fetchAreaActivityAction({ areaFilter: "Legal", periodFilter: "Hoy", aggregation: "Diario" })).resolves.toMatchObject({ success: false });
    expect(mocks.requirePermission).toHaveBeenCalledWith("read", "applications");
    expect(mocks.getAreaActivityMetrics).not.toHaveBeenCalled();
  });

  it("permite a ATENCION_ASOCIADO con read:applications cargar el dashboard", async () => {
    mocks.requirePermission.mockResolvedValue({ role: { id: 2, slug: "ATENCION_ASOCIADO" } });
    mocks.getDashboardData.mockResolvedValue({ kpis: {} });

    await expect(fetchDashboardStats()).resolves.toMatchObject({ success: true });
    expect(mocks.getDashboardData).toHaveBeenCalledWith(2, "ATENCION_ASOCIADO");
  });

  it("preserva a SUPER_ADMIN (manage:all) mediante requirePermission autorizado", async () => {
    mocks.requirePermission.mockResolvedValue({ role: { id: 1, slug: "SUPER_ADMIN" } });
    mocks.getDashboardData.mockResolvedValue({ kpis: {} });

    await expect(fetchDashboardStats()).resolves.toMatchObject({ success: true });
    expect(mocks.getDashboardData).toHaveBeenCalledWith(1, "SUPER_ADMIN");
  });

  it("devuelve { success:false } sin data cuando el permiso es denegado", async () => {
    mocks.requirePermission.mockRejectedValue(new Error("denied"));

    const res = await fetchDashboardStats();
    expect(res).toMatchObject({ success: false });
    expect(res).not.toHaveProperty("data");
    expect(mocks.getDashboardData).not.toHaveBeenCalled();
  });
});
