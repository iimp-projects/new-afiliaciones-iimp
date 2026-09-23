import { beforeEach, describe, expect, it, vi } from "vitest";

const getCurrentUser = vi.hoisted(() => vi.fn());
const hasPermission = vi.hoisted(() => vi.fn());

vi.mock("./service", () => ({
  contextService: { getCurrentUser, hasPermission },
}));

import { getInternalApiUser, requireApiPermission } from "./api-authorization";

const internalUser = { id: 1, status: "ACTIVE", type: "SYSTEM_ADMIN", role: { slug: "SYSTEM_ADMIN" }, permissions: new Set<string>() };
const affiliateActive = { id: 2, status: "ACTIVE", type: "AFFILIATE", role: { slug: "ASOCIADO_ACTIVO" }, permissions: new Set<string>() };
const affiliateStudent = { id: 3, status: "ACTIVE", type: "AFFILIATE", role: { slug: "ASOCIADO_ESTUDIANTE" }, permissions: new Set<string>() };

describe("requireApiPermission affiliate boundary", () => {
  beforeEach(() => {
    getCurrentUser.mockReset();
    hasPermission.mockReset();
  });

  it("deniega a ASOCIADO_ACTIVO el acceso a una API administrativa", async () => {
    getCurrentUser.mockResolvedValue(affiliateActive);
    hasPermission.mockResolvedValue(true);

    await expect(requireApiPermission("read", "memberships")).rejects.toMatchObject({ status: 403 });
  });

  it("deniega a ASOCIADO_ESTUDIANTE el acceso a una API administrativa", async () => {
    getCurrentUser.mockResolvedValue(affiliateStudent);
    hasPermission.mockResolvedValue(true);

    await expect(requireApiPermission("read", "memberships")).rejects.toMatchObject({ status: 403 });
  });

  it("permite a un usuario interno con el permiso requerido", async () => {
    getCurrentUser.mockResolvedValue(internalUser);
    hasPermission.mockResolvedValue(true);

    await expect(requireApiPermission("read", "memberships")).resolves.toBe(internalUser);
  });

  it("deniega a un usuario interno sin el permiso requerido", async () => {
    getCurrentUser.mockResolvedValue(internalUser);
    hasPermission.mockResolvedValue(false);

    await expect(requireApiPermission("read", "memberships")).rejects.toMatchObject({ status: 403 });
  });

  it("deniega a un anónimo con 401", async () => {
    getCurrentUser.mockResolvedValue(null);

    await expect(requireApiPermission("read", "memberships")).rejects.toMatchObject({ status: 401 });
  });
});

describe("getInternalApiUser", () => {
  beforeEach(() => {
    getCurrentUser.mockReset();
  });

  it("devuelve null para identidades afiliadas", async () => {
    getCurrentUser.mockResolvedValue(affiliateActive);
    await expect(getInternalApiUser()).resolves.toBeNull();
    getCurrentUser.mockResolvedValue(affiliateStudent);
    await expect(getInternalApiUser()).resolves.toBeNull();
  });

  it("devuelve el usuario para una identidad interna activa", async () => {
    getCurrentUser.mockResolvedValue(internalUser);
    await expect(getInternalApiUser()).resolves.toBe(internalUser);
  });

  it("devuelve null para un anónimo o inactivo", async () => {
    getCurrentUser.mockResolvedValue(null);
    await expect(getInternalApiUser()).resolves.toBeNull();
    getCurrentUser.mockResolvedValue({ ...internalUser, status: "INACTIVE" });
    await expect(getInternalApiUser()).resolves.toBeNull();
  });
});
