import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  hasPermission: vi.fn(),
  requireAuth: vi.fn(),
  fetchAsociadosAction: vi.fn(),
  AsociadosWorkspace: vi.fn(() => null),
}));

vi.mock("@/modules/auth/context/service", () => ({
  contextService: {
    requirePermission: mocks.requirePermission,
    hasPermission: mocks.hasPermission,
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
  AsociadosWorkspace: mocks.AsociadosWorkspace,
}));

import AsociadosPage from "./page";

describe("Directorio de Asociados — página", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue(undefined);
    mocks.hasPermission.mockResolvedValue(true);
    mocks.requireAuth.mockResolvedValue({ role: { slug: "COMITE_EVALUADOR" } });
    mocks.fetchAsociadosAction.mockResolvedValue({ data: [], total: 0 });
  });

  it("exige read:associates y consulta read:memberships sin bloquear el directorio", async () => {
    await AsociadosPage({ searchParams: Promise.resolve({}) });

    expect(mocks.requirePermission).toHaveBeenCalledWith("read", "associates");
    expect(mocks.requirePermission).not.toHaveBeenCalledWith("read", "memberships");
    expect(mocks.hasPermission).toHaveBeenCalledWith("read", "memberships");
    expect(mocks.fetchAsociadosAction).toHaveBeenCalled();
  });

  it("propaga la ausencia de read:memberships sin impedir el directorio", async () => {
    mocks.hasPermission.mockResolvedValue(false);

    const page = await AsociadosPage({ searchParams: Promise.resolve({}) });

    expect((page as { props: { children: { props: unknown } } }).props.children.props).toMatchObject({ canReadMemberships: false });
  });
});
