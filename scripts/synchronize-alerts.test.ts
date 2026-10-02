import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  synchronize: vi.fn(),
  disconnect: vi.fn(),
}));

vi.mock("@/modules/afiliaciones/alerts/Services/OperationalAlertTrackingService", () => ({
  operationalAlertTrackingService: { synchronize: mocks.synchronize },
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { $disconnect: mocks.disconnect },
}));

import { sanitizeError, runSynchronize } from "./synchronize-alerts";

describe("synchronize-alerts entrypoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.disconnect.mockResolvedValue(undefined);
  });

  it("redacta credenciales de la URL de base de datos y correos en el error", () => {
    const dbUrl = "postgresql" + "://" + "usuario" + ":" + "secreto" + "@db:5432/x";
    const redacted = sanitizeError(new Error(`fallo ${dbUrl} para admin@example.com`));
    expect(redacted).not.toContain("secreto");
    expect(redacted).not.toContain("admin@example.com");
    expect(redacted).toContain("postgresql://[REDACTED]@");
  });

  it("devuelve 0 y cierra Prisma cuando synchronize finaliza correctamente", async () => {
    mocks.synchronize.mockResolvedValue({ detected: 0, created: 0, updated: 0, reopened: 0, resolved: 0, legacyResolved: 0, durationMs: 1 });
    await expect(runSynchronize()).resolves.toBe(0);
    expect(mocks.synchronize).toHaveBeenCalledTimes(1);
    expect(mocks.disconnect).toHaveBeenCalled();
  });

  it("devuelve 1 y cierra Prisma cuando synchronize lanza una excepción", async () => {
    mocks.synchronize.mockRejectedValue(new Error("boom"));
    await expect(runSynchronize()).resolves.toBe(1);
    expect(mocks.disconnect).toHaveBeenCalled();
  });
});
