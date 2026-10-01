import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  requireAuth: vi.fn(),
  fetchAsociadosAction: vi.fn(),
}));

vi.mock("@/modules/auth/context/service", () => ({
  contextService: {
    requirePermission: mocks.requirePermission,
    requireAuth: mocks.requireAuth,
  },
}));
vi.mock("@/modules/afiliaciones/asociados/Actions/asociados.actions", () => ({
  fetchAsociadosAction: mocks.fetchAsociadosAction,
}));
vi.mock("@/modules/afiliaciones/payments/Config/PaymentConfig", () => ({
  paymentConfig: { environment: "PRODUCTION" },
}));
vi.mock("@/modules/afiliaciones/asociados/Views/AsociadosWorkspace.tsx", () => ({
  AsociadosWorkspace: () => null,
}));

import AsociadosPage from "./page";

describe("Directorio de Asociados — página", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue(undefined);
    mocks.requireAuth.mockResolvedValue({ role: { slug: "COMITE_EVALUADOR" } });
    mocks.fetchAsociadosAction.mockResolvedValue({ data: [], total: 0 });
  });

  it("exige read:associates (no read:memberships) para abrir el directorio", async () => {
    await AsociadosPage({ searchParams: Promise.resolve({}) });

    expect(mocks.requirePermission).toHaveBeenCalledWith("read", "associates");
    expect(mocks.requirePermission).not.toHaveBeenCalledWith("read", "memberships");
    expect(mocks.fetchAsociadosAction).toHaveBeenCalled();
  });
});
