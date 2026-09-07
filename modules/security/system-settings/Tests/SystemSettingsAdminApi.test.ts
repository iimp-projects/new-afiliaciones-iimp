import { describe, expect, it, vi } from "vitest";

const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));

vi.mock("../../../auth/context/service", () => ({ contextService: { getCurrentUser } }));
vi.mock("../../../auth/errors", () => ({
  AuthorizationError: class AuthorizationError extends Error {},
}));

import { requireSystemSettingsSuperAdmin } from "../Api/SystemSettingsAdminApi";
import { SYSTEM_SETTING_KEYS } from "../Models/SystemSettingKeys";
import { seedSystemSettings } from "../../../../prisma/seed/system/system-settings.seed";

describe("System Settings admin backend", () => {
  it("permite el acceso únicamente a SUPER_ADMIN", async () => {
    getCurrentUser.mockResolvedValueOnce({ id: 1, role: { slug: "SUPER_ADMIN" } });
    await expect(requireSystemSettingsSuperAdmin()).resolves.toMatchObject({ id: 1 });
    getCurrentUser.mockResolvedValueOnce({ id: 2, role: { slug: "SYSTEM_ADMIN" } });
    await expect(requireSystemSettingsSuperAdmin()).rejects.toThrow();
  });

  it("crea de forma idempotente las 13 definiciones y nunca valores", async () => {
    const upsert = vi.fn().mockResolvedValue({});
    const database = { systemSetting: { upsert } } as never;
    await seedSystemSettings(database);
    await seedSystemSettings(database);
    expect(upsert).toHaveBeenCalledTimes(Object.keys(SYSTEM_SETTING_KEYS).length * 2);
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ update: {}, create: expect.not.objectContaining({ value: expect.anything() }) }));
  });
});
