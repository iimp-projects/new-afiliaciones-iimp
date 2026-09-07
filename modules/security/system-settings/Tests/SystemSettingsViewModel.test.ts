import { describe, expect, it } from "vitest";
import { getValueState, groupSettings, type SystemSettingViewModel } from "../Models/SystemSettingsViewModel";

const setting = (overrides: Partial<SystemSettingViewModel> = {}): SystemSettingViewModel => ({
  key: "PAYMENT_REGISTRATION_PRICE", category: "PAYMENTS", dataType: "MONEY", description: null, isActive: true,
  currentValue: "300.00", currentValueId: 1, currentStartsAt: "2026-09-01T00:00:00.000Z", currentEndsAt: null,
  hasCurrentValue: true, futureValues: [], historicalValues: [], inactiveValues: [], ...overrides,
});

describe("System Settings view model", () => {
  it("agrupa configuraciones por categoría", () => {
    const groups = groupSettings([setting(), setting({ key: "CARD_ENABLED", category: "PAYMENT_METHODS", dataType: "BOOLEAN" })]);
    expect(groups.PAYMENTS).toHaveLength(1);
    expect(groups.PAYMENT_METHODS).toHaveLength(1);
  });

  it("distingue valores vigentes, programados, deshabilitados e históricos", () => {
    expect(getValueState(setting())).toBe("Activo");
    expect(getValueState(setting({ currentValue: null, currentValueId: null, currentStartsAt: null, hasCurrentValue: false, futureValues: [{ id: 2, value: "350.00", startsAt: "2027-01-01T00:00:00.000Z", endsAt: null, isActive: true }] }))).toBe("Programado");
    expect(getValueState(setting({ isActive: false }))).toBe("Deshabilitado");
    expect(getValueState(setting({ key: "PAYMENTS_ENABLED", dataType: "BOOLEAN", currentValue: "false" }))).toBe("Deshabilitado");
  });
});
