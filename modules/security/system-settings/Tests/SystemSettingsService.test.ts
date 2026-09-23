import { ConfigDataType } from "@prisma/client";
import { describe, expect, it, vi, type Mock } from "vitest";
import { SYSTEM_SETTING_KEYS } from "../Models/SystemSettingKeys";
import type { ISystemSettingsRepository } from "../Repositories/Interfaces/ISystemSettingsRepository";
import { SystemSettingsError, SystemSettingsService } from "../Services/SystemSettingsService";

const now = new Date("2026-09-04T12:00:00.000Z");
const setting = (key: string, dataType: ConfigDataType) => ({ id: 1, key, category: "PAYMENTS", dataType, description: null, isActive: true, createdAt: now, updatedAt: now });
const value = (overrides = {}) => ({ id: 10, settingId: 1, value: "300.00", startsAt: new Date("2026-09-01T00:00:00Z"), endsAt: null, isActive: true, updatedById: 5, createdAt: now, updatedAt: now, ...overrides });
type RepositoryMock = ISystemSettingsRepository & {
  findCurrentValue: Mock;
  findOverlappingValues: Mock;
  createAuditLog: Mock;
};

function repository(overrides: Record<string, unknown> = {}): RepositoryMock {
  return {
    withTransaction: async (callback: (tx: Record<string, never>) => unknown) => callback({}), findSettingByKey: vi.fn(), findSettingById: vi.fn(), findCurrentValue: vi.fn(), findValuesBySetting: vi.fn(), findOverlappingValues: vi.fn().mockResolvedValue([]), createValue: vi.fn().mockResolvedValue(value()), updateValue: vi.fn().mockResolvedValue(value()), findValueById: vi.fn(), createAuditLog: vi.fn(), ...overrides,
  } as unknown as RepositoryMock;
}

describe("SystemSettingsService", () => {
  it("resuelve el valor vigente y no devuelve uno futuro", async () => {
    const repo = repository({ findCurrentValue: vi.fn().mockResolvedValue({ ...value(), setting: setting(SYSTEM_SETTING_KEYS.PAYMENT_REGISTRATION_PRICE, ConfigDataType.MONEY) }) });
    const service = new SystemSettingsService(repo);
    expect((await service.getCurrentValue(SYSTEM_SETTING_KEYS.PAYMENT_REGISTRATION_PRICE, now))?.rawValue).toBe("300.00");
    repo.findCurrentValue.mockResolvedValueOnce(null);
    expect(await service.getCurrentValue(SYSTEM_SETTING_KEYS.PAYMENT_REGISTRATION_PRICE, new Date("2026-08-01"))).toBeNull();
  });
  it("no resuelve valores inactivos y admite una vigencia abierta", async () => {
    const repo = repository({
      findCurrentValue: vi.fn().mockResolvedValue(null),
      findSettingByKey: vi.fn().mockResolvedValue(setting(SYSTEM_SETTING_KEYS.PAYMENTS_ENABLED, ConfigDataType.BOOLEAN)),
    });
    const service = new SystemSettingsService(repo);
    expect(await service.getCurrentValue(SYSTEM_SETTING_KEYS.PAYMENTS_ENABLED, now)).toBeNull();
    await service.createValue({ key: SYSTEM_SETTING_KEYS.PAYMENTS_ENABLED, value: "true", startsAt: now, endsAt: null, isActive: false, updatedById: 5 });
    expect(repo.findOverlappingValues).not.toHaveBeenCalled();
  });
  it("mantiene endsAt exclusivo y permite intervalos consecutivos", async () => {
    const repo = repository({ findSettingByKey: vi.fn().mockResolvedValue(setting(SYSTEM_SETTING_KEYS.PAYMENT_REGISTRATION_PRICE, ConfigDataType.MONEY)) });
    const service = new SystemSettingsService(repo);
    await service.createValue({ key: SYSTEM_SETTING_KEYS.PAYMENT_REGISTRATION_PRICE, value: "350.00", startsAt: new Date("2027-01-01"), endsAt: null, isActive: true, updatedById: 5 });
    expect(repo.findOverlappingValues).toHaveBeenCalledWith(1, new Date("2027-01-01"), null, undefined, expect.anything());
  });
  it("rechaza solapamientos activos", async () => {
    const repo = repository({ findSettingByKey: vi.fn().mockResolvedValue(setting(SYSTEM_SETTING_KEYS.PAYMENT_REGISTRATION_PRICE, ConfigDataType.MONEY)), findOverlappingValues: vi.fn().mockResolvedValue([value()]) });
    await expect(new SystemSettingsService(repo).createValue({ key: SYSTEM_SETTING_KEYS.PAYMENT_REGISTRATION_PRICE, value: "350.00", startsAt: now, endsAt: null, isActive: true })).rejects.toMatchObject({ status: 409 } satisfies Partial<SystemSettingsError>);
  });
  it("excluye el propio registro al actualizar", async () => {
    const repo = repository({ findValueById: vi.fn().mockResolvedValue(value()), findSettingById: vi.fn().mockResolvedValue(setting(SYSTEM_SETTING_KEYS.PAYMENT_REGISTRATION_PRICE, ConfigDataType.MONEY)) });
    await new SystemSettingsService(repo).updateValue(10, { value: "300.00", startsAt: now, endsAt: null, isActive: true, updatedById: 5 });
    expect(repo.findOverlappingValues).toHaveBeenCalledWith(1, now, null, 10, expect.anything());
  });
  it.each([[ConfigDataType.MONEY, "-1"], [ConfigDataType.BOOLEAN, "yes"], [ConfigDataType.DATETIME, "tomorrow"], [ConfigDataType.URL, "not-url"]])("valida %s", async (dataType, invalid) => {
    const repo = repository({ findCurrentValue: vi.fn().mockResolvedValue({ ...value({ value: invalid }), setting: setting(SYSTEM_SETTING_KEYS.PAYMENT_REGISTRATION_PRICE, dataType) }) });
    await expect(new SystemSettingsService(repo).getCurrentValue(SYSTEM_SETTING_KEYS.PAYMENT_REGISTRATION_PRICE, now)).rejects.toBeInstanceOf(SystemSettingsError);
  });
  it("audita creación y cambios de estado", async () => {
    const repo = repository({ findSettingByKey: vi.fn().mockResolvedValue(setting(SYSTEM_SETTING_KEYS.PAYMENTS_ENABLED, ConfigDataType.BOOLEAN)), findValueById: vi.fn().mockResolvedValue(value({ value: "true", isActive: true })), findSettingById: vi.fn().mockResolvedValue(setting(SYSTEM_SETTING_KEYS.PAYMENTS_ENABLED, ConfigDataType.BOOLEAN)), updateValue: vi.fn().mockResolvedValue(value({ value: "false", isActive: false })) });
    const service = new SystemSettingsService(repo);
    await service.createValue({ key: SYSTEM_SETTING_KEYS.PAYMENTS_ENABLED, value: "true", startsAt: now, isActive: true, updatedById: 5 });
    await service.updateValue(10, { value: "false", startsAt: now, isActive: false, updatedById: 5 });
    expect(repo.createAuditLog).toHaveBeenNthCalledWith(1, expect.objectContaining({ action: "CREATE_SETTING_VALUE" }), expect.anything());
    expect(repo.createAuditLog).toHaveBeenNthCalledWith(2, expect.objectContaining({ action: "DISABLE_SETTING_VALUE" }), expect.anything());
  });
  it("prepara precio con fallback TEST solo ante ausencia", async () => {
    vi.stubEnv("PAYMENT_ENVIRONMENT", "TEST");
    vi.resetModules();
    try {
      const { PaymentSettingsResolver } = await import("../Services/PaymentSettingsResolver");
      const resolver = new PaymentSettingsResolver({ getCurrentValue: vi.fn().mockResolvedValue(null) } as never);
      const price = await resolver.getRegistrationPrice(now);
      expect(price.amount.toString()).toBe("300");
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });
});
