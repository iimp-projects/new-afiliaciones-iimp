import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  requireRole: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("@/modules/auth/context/service", () => ({
  contextService: {
    getCurrentUser: mocks.getCurrentUser,
    requireRole: mocks.requireRole,
  },
}));

vi.mock("@/modules/shared/Services/SapService", () => ({
  SapService: class {
    login = mocks.login;
    logout = mocks.logout;
  },
}));

import { GET } from "./route";

describe("GET /api/sap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rechaza solicitudes anónimas", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(mocks.login).not.toHaveBeenCalled();
  });

  it("no expone el identificador de sesión SAP", async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: 1 });
    mocks.requireRole.mockResolvedValue(undefined);
    mocks.login.mockResolvedValue("dummy-sap-session");
    mocks.logout.mockResolvedValue(undefined);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, message: "Conexión con SAP verificada." });
    expect(JSON.stringify(body)).not.toContain("dummy-sap-session");
    expect(mocks.logout).toHaveBeenCalledWith("dummy-sap-session");
  });
});
