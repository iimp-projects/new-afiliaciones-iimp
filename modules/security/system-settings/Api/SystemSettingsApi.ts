import type { SystemSettingViewModel } from "../Models/SystemSettingsViewModel";
import type { PaymentConfigurationHealth } from "../Services/PaymentConfigurationHealthService";

export interface SettingValuePayload { value: string; startsAt: string; endsAt?: string | null; isActive: boolean; }

export class SystemSettingsApi {
  private async request<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
    const body = await response.json();
    if (!response.ok || !body.success) throw new Error(body.message || "No se pudo procesar la configuración.");
    return body.data as T;
  }
  async list(): Promise<{ settings: SystemSettingViewModel[]; environment: "TEST" | "PRODUCTION"; health: PaymentConfigurationHealth }> {
    const response = await fetch("/api/system-settings");
    const body = await response.json();
    if (!response.ok || !body.success) throw new Error(body.message || "No se pudo cargar la configuración.");
    return { settings: body.data as SystemSettingViewModel[], environment: body.environment === "PRODUCTION" ? "PRODUCTION" : "TEST", health: body.health as PaymentConfigurationHealth };
  }
  async create(key: string, payload: SettingValuePayload) { return this.request(`/api/system-settings/${encodeURIComponent(key)}/values`, { method: "POST", body: JSON.stringify(payload) }); }
  async update(id: number, payload: SettingValuePayload) { return this.request(`/api/system-settings/values/${id}`, { method: "PATCH", body: JSON.stringify(payload) }); }
  async updateStatus(id: number, isActive: boolean) { return this.request(`/api/system-settings/values/${id}/status`, { method: "PATCH", body: JSON.stringify({ isActive }) }); }
}
