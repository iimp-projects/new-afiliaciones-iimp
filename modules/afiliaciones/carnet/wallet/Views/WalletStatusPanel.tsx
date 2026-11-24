"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Smartphone, Wallet } from "lucide-react";

interface PassJob {
  operation: "SYNC" | "REVOKE";
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "RETRY" | "FAILED" | "SUPERSEDED";
  attemptCount: number;
  maxAttempts: number;
  nextAttemptAt: string | null;
  lastErrorCode: string | null;
}

interface PassSummary {
  provider: "GOOGLE" | "APPLE";
  syncStatus: "PENDING" | "SYNCED" | "FAILED" | "REVOKED";
  lastSyncedAt: string | null;
  lastErrorCode: string | null;
  revokedAt: string | null;
  deviceCount: number;
  job: PassJob | null;
}

interface StatusBody {
  enabled: { google: boolean; apple: boolean };
  configured: { google: boolean; apple: boolean };
  simulation: boolean;
  card: { generated: boolean; status: "ISSUED" | "REVOKED" | null; eligible: boolean };
  passes: PassSummary[];
}

const STATUS_LABEL: Record<PassSummary["syncStatus"], string> = {
  PENDING: "Pendiente",
  SYNCED: "Actualizado en proveedor",
  FAILED: "Con error",
  REVOKED: "Revocado",
};

const JOB_LABEL: Record<PassJob["status"], string> = {
  PENDING: "En cola",
  PROCESSING: "Procesando",
  COMPLETED: "Completado",
  RETRY: "Reintentando",
  FAILED: "Fallido",
  SUPERSEDED: "Reemplazado",
};

const ERROR_LABEL: Record<string, string> = {
  GOOGLE_NOT_CONFIGURED: "Google Wallet no está configurado.",
  APPLE_NOT_CONFIGURED: "Apple Wallet no está configurado.",
  PROVIDER_NOT_CONFIGURED: "El proveedor no está configurado.",
  PROVIDER_DISABLED: "El proveedor está deshabilitado.",
  PROVIDER_ERROR: "El proveedor no respondió correctamente; se reintentará.",
  GOOGLE_SYNC_FAILED: "No se pudo sincronizar el pase de Google.",
  APPLE_SYNC_FAILED: "No se pudo sincronizar el pase de Apple.",
  SYNC_ERROR: "No se pudo completar la sincronización.",
  LEASE_EXPIRED: "El procesamiento se interrumpió y será reintentado.",
};

function formatDate(value: string | null): string {
  if (!value) return "Sin sincronizar";
  return new Intl.DateTimeFormat("es-PE", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function providerData(status: StatusBody, provider: "GOOGLE" | "APPLE") {
  const pass = status.passes.find((item) => item.provider === provider) ?? null;
  return {
    name: provider === "GOOGLE" ? "Google Wallet" : "Apple Wallet",
    enabled: provider === "GOOGLE" ? status.enabled.google : status.enabled.apple,
    configured: provider === "GOOGLE" ? status.configured.google : status.configured.apple,
    pass,
  };
}

export function WalletStatusPanel({ personId, canManage }: { personId: number; canManage: boolean }) {
  const [status, setStatus] = useState<StatusBody | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/afiliaciones/carnet/${personId}/wallet`, { cache: "no-store" });
      const body = (await response.json().catch(() => null)) as { success?: boolean; data?: StatusBody; message?: string } | null;
      if (!response.ok || !body?.success || !body.data) {
        setError(body?.message ?? "No fue posible consultar las billeteras digitales.");
        setStatus(null);
        return;
      }
      setStatus(body.data);
    } catch {
      setError("No fue posible consultar las billeteras digitales.");
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [personId]);

  useEffect(() => {
    void load();
  }, [load]);

  const sync = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/afiliaciones/carnet/${personId}/wallet/sync`, { method: "POST" });
      const body = (await response.json().catch(() => null)) as { success?: boolean; message?: string } | null;
      if (!response.ok || !body?.success) {
        setError(body?.message ?? "No fue posible reintentar la sincronización.");
        return;
      }
      setMessage("Sincronización ejecutada. Revisa el estado actualizado.");
      await load();
    } catch {
      setError("No fue posible reintentar la sincronización.");
    } finally {
      setSyncing(false);
    }
  }, [personId, syncing, load]);

  if (loading && !status) {
    return <div className="rounded-xl border border-slate-200 bg-white p-4" aria-busy="true"><div className="h-4 w-32 animate-pulse rounded bg-slate-100" /><div className="mt-3 h-10 animate-pulse rounded bg-slate-100" /></div>;
  }

  return (
    <div className="border-t border-slate-100 pt-4">
      <div className="flex items-center gap-2">
        <Wallet size={16} className="text-[#a87924]" aria-hidden="true" />
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Billeteras digitales</p>
      </div>

      {error && <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-700">{error}</p>}

      {status?.simulation && (
        <p role="status" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11px] font-semibold leading-5 text-amber-800">
          Modo simulación local: los pases mostrados no fueron emitidos por Google ni Apple.
        </p>
      )}

      {status && (
        <div className="mt-3 space-y-3">
          {(["GOOGLE", "APPLE"] as const).map((provider) => {
            const data = providerData(status, provider);
            const label = !data.enabled
              ? "Deshabilitado"
              : !data.configured
                ? "Sin configurar"
                : data.pass?.job
                  ? JOB_LABEL[data.pass.job.status]
                  : data.pass
                    ? STATUS_LABEL[data.pass.syncStatus]
                    : "No emitido";
            return (
              <div key={provider} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="flex items-center gap-2 text-xs font-semibold text-[#14233D]">
                    {provider === "APPLE" ? <Smartphone size={14} aria-hidden="true" /> : <Wallet size={14} aria-hidden="true" />}
                    {data.name}
                  </p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${data.pass?.syncStatus === "FAILED" ? "bg-red-50 text-red-700" : data.pass?.syncStatus === "REVOKED" ? "bg-slate-100 text-slate-600" : "bg-emerald-50 text-emerald-700"}`}>{label}</span>
                </div>
                <dl className="mt-2 space-y-1 text-[11px] leading-5 text-slate-500">
                  <div className="flex justify-between gap-3"><dt>Última sincronización</dt><dd className="text-right">{formatDate(data.pass?.lastSyncedAt ?? null)}</dd></div>
                  {data.pass?.job && <div className="flex justify-between gap-3"><dt>Operación</dt><dd className="text-right">{data.pass.job.operation === "REVOKE" ? "Revocación" : "Actualización"}</dd></div>}
                  {data.pass?.job && <div className="flex justify-between gap-3"><dt>Intentos</dt><dd className="text-right">{data.pass.job.attemptCount}/{data.pass.job.maxAttempts}</dd></div>}
                  {data.pass?.job?.nextAttemptAt && <div className="flex justify-between gap-3"><dt>Próximo reintento</dt><dd className="text-right">{formatDate(data.pass.job.nextAttemptAt)}</dd></div>}
                  {provider === "APPLE" && <div className="flex justify-between gap-3"><dt>Dispositivos registrados</dt><dd className="text-right">{data.pass?.deviceCount ?? 0}</dd></div>}
                  {data.pass?.lastErrorCode && <div className="text-red-600">{ERROR_LABEL[data.pass.lastErrorCode] ?? "La sincronización requiere revisión."}</div>}
                </dl>
              </div>
            );
          })}
          {canManage ? (
            <button
              type="button"
              onClick={() => void sync()}
              disabled={syncing || !status.card.generated}
              aria-busy={syncing}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw size={14} className={syncing ? "animate-spin" : ""} aria-hidden="true" /> {syncing ? "Sincronizando…" : "Reintentar sincronización"}
            </button>
          ) : (
            <p className="text-[11px] leading-5 text-slate-500">Modo solo consulta: no tienes permiso para reintentar la sincronización.</p>
          )}
          {message && <p role="status" className="text-[11px] leading-5 text-slate-500">{message}</p>}
          <p className="text-[11px] leading-5 text-slate-400">La instalación del pase en el dispositivo solo se confirma con el registro de Apple Wallet o la evidencia del proveedor. Un pase emitido no implica que esté instalado.</p>
        </div>
      )}
    </div>
  );
}
