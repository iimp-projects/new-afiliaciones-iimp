import { prisma } from "../../../../lib/prisma";
import type { Prisma, PrismaClient } from "@prisma/client";
import type { ISystemSettingsRepository, SystemSettingsTransaction, SystemSettingValueData } from "./Interfaces/ISystemSettingsRepository";

type Database = PrismaClient | SystemSettingsTransaction;

export class SystemSettingsRepository implements ISystemSettingsRepository {
  constructor(private readonly db: PrismaClient = prisma) {}
  withTransaction<T>(callback: (tx: SystemSettingsTransaction) => Promise<T>): Promise<T> { return this.db.$transaction(callback); }
  async findSettingByKey(key: string, tx?: SystemSettingsTransaction) { return this.client(tx).systemSetting.findUnique({ where: { key } }); }
  async findSettingById(id: number, tx?: SystemSettingsTransaction) { return this.client(tx).systemSetting.findUnique({ where: { id } }); }
  async findSettings(tx?: SystemSettingsTransaction) { return this.client(tx).systemSetting.findMany({ orderBy: [{ category: "asc" }, { key: "asc" }] }); }
  async findCurrentValue(key: string, now: Date, tx?: SystemSettingsTransaction) {
    return this.client(tx).systemSettingValue.findFirst({ where: { setting: { key, isActive: true }, isActive: true, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] }, include: { setting: true }, orderBy: { startsAt: "desc" } });
  }
  async findValuesBySetting(settingId: number, tx?: SystemSettingsTransaction) { return this.client(tx).systemSettingValue.findMany({ where: { settingId }, orderBy: { startsAt: "asc" } }); }
  async findOverlappingValues(settingId: number, startsAt: Date, endsAt: Date | null, excludeId?: number, tx?: SystemSettingsTransaction) {
    return this.client(tx).systemSettingValue.findMany({ where: { settingId, isActive: true, ...(excludeId ? { id: { not: excludeId } } : {}), startsAt: endsAt ? { lt: endsAt } : undefined, OR: [{ endsAt: null }, { endsAt: { gt: startsAt } }] } });
  }
  async createValue(data: SystemSettingValueData, tx?: SystemSettingsTransaction) { return this.client(tx).systemSettingValue.create({ data }); }
  async updateValue(id: number, data: Partial<SystemSettingValueData>, tx?: SystemSettingsTransaction) { return this.client(tx).systemSettingValue.update({ where: { id }, data }); }
  async findValueById(id: number, tx?: SystemSettingsTransaction) { return this.client(tx).systemSettingValue.findUnique({ where: { id } }); }
  async createAuditLog(data: { userId?: number | null; action: string; entityId: string; oldValues?: Prisma.InputJsonValue; newValues?: Prisma.InputJsonValue }, tx: SystemSettingsTransaction) {
    await tx.auditLog.create({ data: { userId: data.userId ?? null, action: data.action, entity: "SystemSettingValue", entityId: data.entityId, oldValues: data.oldValues, newValues: data.newValues } });
  }
  private client(tx?: SystemSettingsTransaction): Database { return tx ?? this.db; }
}
