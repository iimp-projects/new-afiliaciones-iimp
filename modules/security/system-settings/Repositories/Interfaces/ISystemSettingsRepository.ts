import type { Prisma, SystemSetting, SystemSettingValue } from "@prisma/client";

export type SystemSettingsTransaction = Prisma.TransactionClient;
export type SettingWithValues = SystemSetting & { values: SystemSettingValue[] };

export interface SystemSettingValueData {
  settingId: number;
  value: string;
  startsAt: Date;
  endsAt?: Date | null;
  isActive: boolean;
  updatedById?: number | null;
}

export interface ISystemSettingsRepository {
  withTransaction<T>(callback: (tx: SystemSettingsTransaction) => Promise<T>): Promise<T>;
  findSettingByKey(key: string, tx?: SystemSettingsTransaction): Promise<SystemSetting | null>;
  findSettingById(id: number, tx?: SystemSettingsTransaction): Promise<SystemSetting | null>;
  findSettings(tx?: SystemSettingsTransaction): Promise<SystemSetting[]>;
  findCurrentValue(key: string, now: Date, tx?: SystemSettingsTransaction): Promise<(SystemSettingValue & { setting: SystemSetting }) | null>;
  findValuesBySetting(settingId: number, tx?: SystemSettingsTransaction): Promise<SystemSettingValue[]>;
  findOverlappingValues(settingId: number, startsAt: Date, endsAt: Date | null, excludeId?: number, tx?: SystemSettingsTransaction): Promise<SystemSettingValue[]>;
  createValue(data: SystemSettingValueData, tx?: SystemSettingsTransaction): Promise<SystemSettingValue>;
  updateValue(id: number, data: Partial<SystemSettingValueData>, tx?: SystemSettingsTransaction): Promise<SystemSettingValue>;
  findValueById(id: number, tx?: SystemSettingsTransaction): Promise<SystemSettingValue | null>;
  createAuditLog(data: { userId?: number | null; action: string; entityId: string; oldValues?: Prisma.InputJsonValue; newValues?: Prisma.InputJsonValue }, tx: SystemSettingsTransaction): Promise<void>;
}
