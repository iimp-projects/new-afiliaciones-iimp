import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireApiPermission: vi.fn(),
  assertCanWriteDepartment: vi.fn(),
  findUnique: vi.fn(),
  transaction: vi.fn(),
  update: vi.fn(),
  count: vi.fn(),
}));

vi.mock("@/modules/auth/context/api-authorization", () => ({
  requireApiPermission: mocks.requireApiPermission,
  apiAuthorizationStatus: () => 500,
}));
vi.mock("@/modules/afiliaciones/expedientes/Services/ExpedienteAuthorizationService", () => ({
  expedienteAuthorizationService: { assertCanWriteDepartment: mocks.assertCanWriteDepartment },
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    membershipObservation: { findUnique: mocks.findUnique },
    $transaction: mocks.transaction,
  },
}));

import { PATCH } from "./route";

const request = (comment: string) => new NextRequest("http://localhost/api/afiliaciones/expedientes/observaciones/5", {
  method: "PATCH",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ comment }),
});
const context = { params: Promise.resolve({ id: "5" }) };

describe("observations route sanitation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireApiPermission.mockResolvedValue({ id: 1, role: { slug: "ATENCION_ASOCIADO" } });
    mocks.findUnique.mockResolvedValue({ reviewDepartment: "ASOCIADOS" });
    mocks.assertCanWriteDepartment.mockReturnValue(undefined);
    mocks.update.mockResolvedValue({ applicationId: 42, reviewDepartment: "ASOCIADOS" });
    mocks.count.mockResolvedValue(1);
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback({ membershipObservation: { update: mocks.update, count: mocks.count } }),
    );
  });

  it("stores plain text without markup and keeps accents", async () => {
    const response = await PATCH(request("<script>alert(1)</script>Hola, José <img src=x onerror=alert(1)>"), context);
    expect(response.status).toBe(200);

    const stored = mocks.update.mock.calls[0][0].data.resolutionComment as string;
    expect(stored).not.toContain("<");
    expect(stored).not.toContain(">");
    expect(stored).toContain("José");
  });

  it("keeps normal text unchanged", async () => {
    await PATCH(request("Documento legible requerido"), context);
    const stored = mocks.update.mock.calls[0][0].data.resolutionComment as string;
    expect(stored).toBe("Documento legible requerido");
  });
});
