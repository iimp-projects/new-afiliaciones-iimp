import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), getPresignedAvatarUrl: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: mocks.findUnique } } }));
vi.mock("@/modules/shared/Services/S3StorageService", () => ({
  S3StorageService: class { getPresignedAvatarUrl = mocks.getPresignedAvatarUrl; },
}));

import { ContextRepository } from "./repository";

function activeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 7, email: "user@example.com", image: null, type: "VALIDATOR", status: "ACTIVE", deletedAt: null,
    person: { firstName: "Ana", paternalLastName: "Pérez", maternalLastName: null, documentNumber: "12345678" },
    role: { id: 2, slug: "LEGAL", isActive: true, rolePermissions: [] },
    ...overrides,
  };
}

describe("ContextRepository active authorization boundary", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    { status: "INACTIVE", deletedAt: null },
    { status: "ACTIVE", deletedAt: new Date() },
  ])("rejects a hydrated user that is not currently active: %#", async ({ status, deletedAt }) => {
    mocks.findUnique.mockResolvedValue(activeUser({ status, deletedAt }));

    await expect(new ContextRepository().getHydratedUser(7)).resolves.toBeNull();
    expect(mocks.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 7, status: "ACTIVE", deletedAt: null },
    }));
  });

  it("excludes inactive permissions from an otherwise active identity", async () => {
    mocks.findUnique.mockResolvedValue(activeUser({
      role: {
        id: 2, slug: "LEGAL", isActive: true, rolePermissions: [
          { permission: { action: "read", subject: "dashboard", isActive: true } },
          { permission: { action: "manage", subject: "all", isActive: false } },
        ],
      },
    }));

    const user = await new ContextRepository().getHydratedUser(7);
    expect(user?.permissions).toEqual(new Set(["read:dashboard"]));
  });

  it("firma el avatar del usuario activo con el propósito de avatar", async () => {
    mocks.findUnique.mockResolvedValue(activeUser({ image: "afiliaciones/perfiles/foto.png" }));
    mocks.getPresignedAvatarUrl.mockResolvedValue("https://signed.example/avatar");

    const user = await new ContextRepository().getHydratedUser(7);
    expect(user?.image).toBe("https://signed.example/avatar");
    expect(mocks.getPresignedAvatarUrl).toHaveBeenCalledWith("afiliaciones/perfiles/foto.png");
  });

  it("deja el avatar en null cuando no está autorizado, sin romper la hidratación", async () => {
    mocks.findUnique.mockResolvedValue(activeUser({ image: "legacy_docs/otro-expediente.pdf" }));
    mocks.getPresignedAvatarUrl.mockResolvedValue(null);

    const user = await new ContextRepository().getHydratedUser(7);
    expect(user?.image).toBeNull();
    expect(user?.permissions).toEqual(new Set());
  });
});
