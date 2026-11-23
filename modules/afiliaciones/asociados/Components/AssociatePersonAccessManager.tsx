"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, Clock3, KeyRound, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";

interface AccessState {
  status: "NOT_PROVISIONED" | "PENDING_ACTIVATION" | "ACTIVE" | "CONFLICT" | "ERROR";
  email?: string;
  role?: string;
  canRetryProvisioning: boolean;
  canResendActivation: boolean;
  message: string;
  applicant?: { name: string; documentNumber: string; email: string; applicationCode: string };
}

export function AssociatePersonAccessManager({ personId, open, onClose }: { personId: number; open: boolean; onClose: () => void }) {
  const [access, setAccess] = useState<AccessState | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/afiliaciones/asociados/person/${personId}/access`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.message);
      setAccess(body.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible consultar el acceso.");
      onClose();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setAccess(null);
      void load();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, personId]);

  const execute = async (action: "retry" | "activation") => {
    setBusy(true);
    try {
      const endpoint = action === "retry"
        ? `/api/afiliaciones/asociados/person/${personId}/access/retry`
        : `/api/afiliaciones/asociados/person/${personId}/resend-activation`;
      const response = await fetch(endpoint, { method: "POST" });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.message);
      setAccess(body.data ?? access);
      toast.success(body.message);
      if (action === "retry") await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible completar la operación.");
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async () => {
    setResetting(true);
    try {
      const response = await fetch(`/api/afiliaciones/asociados/person/${personId}/reset-password`, { method: "POST" });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.message || "No se pudo restablecer la contraseña.");
      toast.success(body.message);
      setResetConfirm(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo restablecer la contraseña.");
    } finally {
      setResetting(false);
    }
  };

  if (!open || typeof document === "undefined") return null;

  const appearance = access?.status === "ACTIVE"
    ? { icon: CheckCircle2, color: "text-emerald-600", label: "Acceso habilitado" }
    : access?.status === "PENDING_ACTIVATION"
      ? { icon: Clock3, color: "text-amber-600", label: "Activación pendiente" }
      : access?.status === "NOT_PROVISIONED"
        ? { icon: KeyRound, color: "text-slate-600", label: "Sin acceso provisionado" }
        : { icon: AlertTriangle, color: "text-amber-700", label: "Acceso no disponible" };
  const Icon = appearance.icon;

  return createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby="person-access-title" className="fixed inset-0 z-[1000000] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#ead9b8] bg-[#fbf4e7] text-[#b48a37]"><KeyRound size={19} /></span>
            <div>
              <h2 id="person-access-title" className="font-black text-slate-800">Gestionar acceso al portal</h2>
              <p className="mt-0.5 text-xs font-medium text-slate-500">Acceso respaldado por cuotas registradas del asociado.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100"><X size={18} /></button>
        </div>

        <div className="px-6 py-5">
          {loading ? <p className="flex items-center gap-2 text-sm text-slate-500"><span className="h-3 w-3 animate-spin rounded-full border-2 border-[#C5A059] border-t-transparent" /> Consultando acceso...</p>
            : access ? (
              <div className="space-y-4">
                <div className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <Icon size={20} className={`mt-0.5 shrink-0 ${appearance.color}`} />
                  <div>
                    <p className="text-sm font-bold text-slate-800">{appearance.label}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-600">{access.message}</p>
                    {access.email && <p className="mt-2 text-xs font-medium text-slate-700">Correo: {access.email}</p>}
                  </div>
                </div>
                {access.status === "ACTIVE" && (
                  <section className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
                    <p className="text-sm font-bold text-amber-900">Restablecer contraseña</p>
                    <p className="mt-1 text-xs leading-5 text-slate-700">
                      Se asignará por defecto su número de documento: <strong>{access.applicant?.documentNumber ?? "No disponible"}</strong>. El usuario deberá cambiarla en su próximo ingreso.
                    </p>
                    {resetConfirm ? (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-amber-900">¿Confirmas que la contraseña será su número de documento?</span>
                        <button type="button" disabled={resetting} onClick={() => void resetPassword()} className="rounded-lg bg-amber-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-60">{resetting ? "Restableciendo..." : "Sí, restablecer"}</button>
                        <button type="button" disabled={resetting} onClick={() => setResetConfirm(false)} className="rounded-lg px-3 py-2 text-xs font-bold text-slate-600">Cancelar</button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setResetConfirm(true)} className="mt-3 rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100">Restablecer contraseña</button>
                    )}
                  </section>
                )}
                {access.applicant && (
                  <dl className="grid gap-2 text-xs sm:grid-cols-2">
                    <div><dt className="font-bold uppercase tracking-wide text-slate-400">Asociado</dt><dd className="mt-0.5 font-semibold text-slate-700">{access.applicant.name}</dd></div>
                    <div><dt className="font-bold uppercase tracking-wide text-slate-400">Documento</dt><dd className="mt-0.5 font-semibold text-slate-700">{access.applicant.documentNumber}</dd></div>
                    <div><dt className="font-bold uppercase tracking-wide text-slate-400">Referencia</dt><dd className="mt-0.5 font-semibold text-slate-700">{access.applicant.applicationCode}</dd></div>
                    <div><dt className="font-bold uppercase tracking-wide text-slate-400">Rol</dt><dd className="mt-0.5 font-semibold text-slate-700">{access.role ?? "No asignado"}</dd></div>
                  </dl>
                )}
              </div>
            ) : null}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100">Cerrar</button>
          {access?.canRetryProvisioning && (
            <button type="button" disabled={busy} onClick={() => void execute("retry")} className="inline-flex items-center gap-1.5 rounded-xl bg-[#172a45] px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
              <KeyRound size={14} /> {busy ? "Habilitando..." : "Habilitar acceso"}
            </button>
          )}
          {access?.canResendActivation && (
            <button type="button" disabled={busy} onClick={() => void execute("activation")} className="inline-flex items-center gap-1.5 rounded-xl border border-[#E6C982] bg-[#FFF8E8] px-4 py-2 text-sm font-bold text-[#936B2E] disabled:opacity-60">
              <RefreshCw size={14} /> {busy ? "Enviando..." : "Reenviar activación"}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
