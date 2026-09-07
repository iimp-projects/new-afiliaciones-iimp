import { ConfigDataType, Prisma } from "@prisma/client";
import { z } from "zod";
import { SYSTEM_SETTING_DEFINITIONS, type SystemSettingKey } from "../Models/SystemSettingKeys";
import type { ISystemSettingsRepository, SystemSettingsTransaction } from "../Repositories/Interfaces/ISystemSettingsRepository";
import { SystemSettingsRepository } from "../Repositories/SystemSettingsRepository";

export interface SystemSettingAdminValue {
  id: number;
  value: string;
  startsAt: Date;
  endsAt: Date | null;
  isActive: boolean;
}

export interface SystemSettingAdminDetail {
  key: string;
  category: string;
  dataType: ConfigDataType;
  description: string | null;
  isActive: boolean;
  currentValue: string | null;
  currentValueId: number | null;
  currentStartsAt: Date | null;
  currentEndsAt: Date | null;
  hasCurrentValue: boolean;
  futureValues: SystemSettingAdminValue[];
  historicalValues: SystemSettingAdminValue[];
  inactiveValues: SystemSettingAdminValue[];
}

export class SystemSettingsError extends Error { constructor(message: string, readonly status = 400) { super(message); } }
export type SettingPrimitive = string | number | boolean | Date | Prisma.Decimal | unknown;

const valueSchema = z.object({ key: z.string().min(1), value: z.string(), startsAt: z.coerce.date(), endsAt: z.coerce.date().nullable().optional(), isActive: z.boolean().default(true), updatedById: z.number().int().positive().nullable().optional() });

export class SystemSettingsService {
  constructor(private readonly repository: ISystemSettingsRepository = new SystemSettingsRepository()) {}

  async getCurrentValue(key: SystemSettingKey, now = new Date()): Promise<{ value: SettingPrimitive; rawValue: string; valueId: number } | null> {
    const current = await this.repository.findCurrentValue(key, now);
    if (!current) return null;
    return { value: this.parseValue(current.setting.dataType, current.value, key), rawValue: current.value, valueId: current.id };
  }

  async listSettings(now = new Date()): Promise<SystemSettingAdminDetail[]> {
    const settings = await this.repository.findSettings();
    return Promise.all(settings.map((setting) => this.getSettingDetail(setting.key, now)));
  }

  async getSettingDetail(key: string, now = new Date()): Promise<SystemSettingAdminDetail> {
    const setting = await this.repository.findSettingByKey(key);
    if (!setting) throw new SystemSettingsError("La configuración no existe.", 404);
    const values = await this.repository.findValuesBySetting(setting.id);
    const activeCurrent = setting.isActive
      ? values.find((value) => value.isActive && value.startsAt <= now && (!value.endsAt || now < value.endsAt)) ?? null
      : null;
    const mapValue = (value: typeof values[number]): SystemSettingAdminValue => ({ id: value.id, value: value.value, startsAt: value.startsAt, endsAt: value.endsAt, isActive: value.isActive });
    return {
      key: setting.key,
      category: setting.category,
      dataType: setting.dataType,
      description: setting.description,
      isActive: setting.isActive,
      currentValue: activeCurrent?.value ?? null,
      currentValueId: activeCurrent?.id ?? null,
      currentStartsAt: activeCurrent?.startsAt ?? null,
      currentEndsAt: activeCurrent?.endsAt ?? null,
      hasCurrentValue: activeCurrent !== null,
      futureValues: values.filter((value) => value.startsAt > now).map(mapValue),
      historicalValues: values.filter((value) => value.endsAt !== null && value.endsAt <= now).map(mapValue),
      inactiveValues: values.filter((value) => !value.isActive).map(mapValue),
    };
  }

  async createValue(input: z.input<typeof valueSchema>) {
    const data = valueSchema.parse(input);
    return this.repository.withTransaction(async (tx) => {
      const setting = await this.repository.findSettingByKey(data.key, tx);
      if (!setting) throw new SystemSettingsError("La configuración no existe.", 404);
      this.validateValue(setting.dataType, data.value, data.key as SystemSettingKey);
      this.validateRange(data.startsAt, data.endsAt ?? null);
      if (data.isActive) await this.assertNoOverlap(setting.id, data.startsAt, data.endsAt ?? null, undefined, tx);
      const created = await this.repository.createValue({ settingId: setting.id, value: data.value.trim(), startsAt: data.startsAt, endsAt: data.endsAt ?? null, isActive: data.isActive, updatedById: data.updatedById ?? null }, tx);
      await this.repository.createAuditLog({ userId: data.updatedById, action: "CREATE_SETTING_VALUE", entityId: String(created.id), newValues: this.auditValue(created) }, tx);
      return created;
    });
  }

  async updateValue(id: number, input: Omit<z.input<typeof valueSchema>, "key">) {
    const data = valueSchema.omit({ key: true }).parse(input);
    return this.repository.withTransaction(async (tx) => {
      const previous = await this.repository.findValueById(id, tx);
      if (!previous) throw new SystemSettingsError("El valor de configuración no existe.", 404);
      const actualSetting = await this.repository.findSettingById(previous.settingId, tx);
      if (!actualSetting) throw new SystemSettingsError("La configuración no existe.", 404);
      this.validateValue(actualSetting.dataType, data.value, actualSetting.key as SystemSettingKey);
      this.validateRange(data.startsAt, data.endsAt ?? null);
      if (data.isActive) await this.assertNoOverlap(previous.settingId, data.startsAt, data.endsAt ?? null, id, tx);
      const updated = await this.repository.updateValue(id, { value: data.value.trim(), startsAt: data.startsAt, endsAt: data.endsAt ?? null, isActive: data.isActive, updatedById: data.updatedById ?? null }, tx);
      const action = previous.isActive !== updated.isActive ? (updated.isActive ? "ENABLE_SETTING_VALUE" : "DISABLE_SETTING_VALUE") : "UPDATE_SETTING_VALUE";
      await this.repository.createAuditLog({ userId: data.updatedById, action, entityId: String(id), oldValues: this.auditValue(previous), newValues: this.auditValue(updated) }, tx);
      return updated;
    });
  }

  async setValueStatus(id: number, isActive: boolean, updatedById: number) {
    const current = await this.repository.findValueById(id);
    if (!current) throw new SystemSettingsError("El valor de configuración no existe.", 404);
    return this.updateValue(id, {
      value: current.value,
      startsAt: current.startsAt,
      endsAt: current.endsAt,
      isActive,
      updatedById,
    });
  }

  private async assertNoOverlap(settingId: number, startsAt: Date, endsAt: Date | null, excludeId: number | undefined, tx: SystemSettingsTransaction) {
    const overlaps = await this.repository.findOverlappingValues(settingId, startsAt, endsAt, excludeId, tx);
    if (overlaps.length) throw new SystemSettingsError("La vigencia se superpone con otro valor activo.", 409);
  }
  private validateRange(startsAt: Date, endsAt: Date | null) { if (endsAt && startsAt >= endsAt) throw new SystemSettingsError("startsAt debe ser anterior a endsAt."); }
  private validateValue(type: ConfigDataType, value: string, key: SystemSettingKey) { this.parseValue(type, value, key); }
  private parseValue(type: ConfigDataType, value: string, key: SystemSettingKey): SettingPrimitive {
    const trimmed = value.trim();
    if (!trimmed) throw new SystemSettingsError("El valor no puede estar vacío.");
    switch (type) {
      case ConfigDataType.STRING: if (key === "NIUBIZ_FORM_BUTTON_COLOR" && !/^#[0-9A-Fa-f]{6}$/.test(trimmed)) throw new SystemSettingsError("El color debe ser hexadecimal #RRGGBB."); return trimmed;
      case ConfigDataType.INTEGER: if (!/^-?\d+$/.test(trimmed)) throw new SystemSettingsError("El valor debe ser un entero."); if (key === "NIUBIZ_SESSION_EXPIRATION_MINUTES" && Number(trimmed) <= 0) throw new SystemSettingsError("La expiración debe ser mayor a cero."); return Number(trimmed);
      case ConfigDataType.DECIMAL: if (!/^-?\d+(\.\d+)?$/.test(trimmed)) throw new SystemSettingsError("El valor debe ser decimal."); return new Prisma.Decimal(trimmed);
      case ConfigDataType.MONEY: { if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) throw new SystemSettingsError("El monto debe ser decimal positivo con hasta dos decimales."); const amount = new Prisma.Decimal(trimmed); const min = SYSTEM_SETTING_DEFINITIONS[key]?.min; if (min && amount.lessThan(new Prisma.Decimal(min))) throw new SystemSettingsError("El monto no cumple el mínimo permitido."); return amount; }
      case ConfigDataType.BOOLEAN: if (trimmed !== "true" && trimmed !== "false") throw new SystemSettingsError("El valor booleano debe ser true o false."); return trimmed === "true";
      case ConfigDataType.JSON: try { return JSON.parse(trimmed); } catch { throw new SystemSettingsError("El valor debe ser JSON válido."); }
      case ConfigDataType.DATETIME: { const date = new Date(trimmed); if (Number.isNaN(date.getTime()) || !/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) throw new SystemSettingsError("El valor debe ser una fecha ISO válida."); return date; }
      case ConfigDataType.URL: try {
        const url = new URL(trimmed);
        if (key === "NIUBIZ_CHECKOUT_LOGO_URL" && process.env.PAYMENT_ENVIRONMENT?.toUpperCase() === "PRODUCTION" && url.protocol !== "https:") {
          throw new SystemSettingsError("En producción el logo de Checkout debe usar HTTPS.");
        }
        return url.toString();
      } catch (error) {
        if (error instanceof SystemSettingsError) throw error;
        throw new SystemSettingsError("El valor debe ser una URL válida.");
      }
      default: throw new SystemSettingsError("Tipo de configuración no soportado.");
    }
  }
  private auditValue(value: { value: string; startsAt: Date; endsAt: Date | null; isActive: boolean }) { return { value: value.value, startsAt: value.startsAt.toISOString(), endsAt: value.endsAt?.toISOString() ?? null, isActive: value.isActive }; }
}
