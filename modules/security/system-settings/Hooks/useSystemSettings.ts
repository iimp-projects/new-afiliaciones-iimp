"use client";

import { useCallback, useEffect, useState } from "react";
import { SystemSettingsApi, type SettingValuePayload } from "../Api/SystemSettingsApi";
import type { SystemSettingViewModel } from "../Models/SystemSettingsViewModel";
import type { PaymentConfigurationHealth } from "../Services/PaymentConfigurationHealthService";

const api = new SystemSettingsApi();

export function useSystemSettings() {
  const [settings, setSettings] = useState<SystemSettingViewModel[]>([]);
  const [environment, setEnvironment] = useState<"TEST" | "PRODUCTION">("TEST");
  const [health, setHealth] = useState<PaymentConfigurationHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try { const result = await api.list(); setSettings(result.settings); setEnvironment(result.environment); setHealth(result.health); } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo cargar la configuración."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    const timeout = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timeout);
  }, [refresh]);
  return {
    settings, environment, health, loading, error, refresh,
    create: async (key: string, payload: SettingValuePayload) => { await api.create(key, payload); await refresh(); },
    update: async (id: number, payload: SettingValuePayload) => { await api.update(id, payload); await refresh(); },
    updateStatus: async (id: number, isActive: boolean) => { await api.updateStatus(id, isActive); await refresh(); },
  };
}
