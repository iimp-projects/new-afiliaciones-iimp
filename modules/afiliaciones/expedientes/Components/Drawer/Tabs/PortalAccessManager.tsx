"use client";
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps -- access state is loaded only while the protected management dialog is open. */

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, KeyRound, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { GlobalModalRoot } from "@/modules/shared/Components/GlobalModalRoot";

type ConflictClassification = "DIFFERENT_IDENTITY" | "INSUFFICIENT_EVIDENCE" | "SAME_IDENTITY_CANDIDATE";
export type PortalAccessState = {
  status: "NOT_PROVISIONED" | "PENDING_ACTIVATION" | "ACTIVE" | "CONFLICT" | "ERROR";
  email?: string;
  canRetryProvisioning: boolean;
  canResendActivation: boolean;
  canChangeEmail?: boolean;
  conflictClassification?: ConflictClassification;
  message: string;
  applicant?: { name: string; documentNumber: string; email: string; applicationCode: string };
  detectedAccount?: { email: string; status: string };
};
type Action = "retry" | "resend-activation" | "change-email";

export function PortalAccessManager({ applicationId, open, onClose, onAccessChanged }: { applicationId: number; open: boolean; onClose: () => void; onAccessChanged?: () => void }) {
  const [access, setAccess] = useState<PortalAccessState | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmation, setConfirmation] = useState<Action | null>(null);
  const [newEmail, setNewEmail] = useState("");

  const load = async () => {
    const response = await fetch(`/api/afiliaciones/expedientes/${applicationId}/access`);
    const body = await response.json();
    if (!response.ok || !body.success) throw new Error(body.message || "No se pudo consultar el acceso.");
    setAccess(body.data);
    setNewEmail(body.data.email || "");
  };

  useEffect(() => {
    if (open) {
      setAccess(null);
      setConfirmation(null);
      void load().catch((error) => toast.error(error instanceof Error ? error.message : "No se pudo consultar el acceso."));
    }
  }, [open, applicationId]);

  const execute = async (action: Action) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/afiliaciones/expedientes/${applicationId}/access/${action === "change-email" ? "change-email" : action}`, {
        method: "POST",
        headers: action === "change-email" ? { "Content-Type": "application/json" } : undefined,
        body: action === "change-email" ? JSON.stringify({ email: newEmail }) : undefined,
      });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.message || "No se pudo completar la operación.");
      setAccess(body.data);
      if (action === "change-email") {
        try {
          const syncResponse = await fetch("/api/afiliaciones/alerts/synchronize", { method: "POST" });
          if (!syncResponse.ok) throw new Error();
          window.dispatchEvent(new Event("operational-alerts-changed"));
        } catch {
          toast.warning("El acceso fue actualizado. Las alertas se sincronizarán en la siguiente ejecución.");
        }
      }
      setConfirmation(null);
      onAccessChanged?.();
      toast.success(body.message || "Acceso actualizado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar el acceso.");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;
  const conflict = access?.status === "CONFLICT";
  const canCorrectEmail = conflict && access?.conflictClassification === "DIFFERENT_IDENTITY" && access.canChangeEmail;
  const title = conflict ? "Resolver conflicto de acceso" : "Gestionar acceso al portal";

  return (
    <GlobalModalRoot title={title} onClose={onClose}>
      <div className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="border-b border-slate-100 p-6">
          <h2 className="text-lg font-black text-slate-800">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {conflict ? "La gestión depende de la clasificación segura de identidad realizada por el servidor." : "Consulta el estado real del acceso y usa únicamente las operaciones administrativas disponibles."}
          </p>
        </div>
        {!access ? <div className="p-8 text-sm text-slate-500">Cargando estado de acceso…</div> : (
          <div className="space-y-5 p-6 text-sm">
            {conflict ? <ConflictContent access={access} newEmail={newEmail} onEmailChange={setNewEmail} canCorrectEmail={Boolean(canCorrectEmail)} /> : <AccessStatus access={access} />}
            {confirmation && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 font-bold text-amber-900">
                {confirmation === "resend-activation" ? `¿Confirmas que deseas reenviar la activación a ${access.email ?? "esta cuenta"}?` : confirmation === "change-email" ? `¿Confirmas que deseas usar ${newEmail.trim().toLowerCase()} para habilitar una cuenta nueva de este postulante?` : "¿Confirmas que deseas habilitar el acceso al portal para este postulante?"}
              </div>
            )}
          </div>
        )}
        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 p-6">
          <button disabled={loading} onClick={onClose} className="rounded-lg px-3 py-2 text-xs font-bold text-slate-600">Cancelar</button>
          {access?.canResendActivation && <ActionButton label="Reenviar activación" icon={RefreshCw} onClick={() => confirmation === "resend-activation" ? void execute("resend-activation") : setConfirmation("resend-activation")} loading={loading} />}
          {access?.canRetryProvisioning && <ActionButton label="Habilitar acceso" icon={KeyRound} onClick={() => confirmation === "retry" ? void execute("retry") : setConfirmation("retry")} loading={loading} />}
          {canCorrectEmail && <ActionButton label="Confirmar y enviar activación" icon={AlertTriangle} onClick={() => void execute("change-email")} loading={loading || !newEmail.trim()} />}
        </div>
      </div>
    </GlobalModalRoot>
  );
}

function ConflictContent({ access, newEmail, onEmailChange, canCorrectEmail }: { access: PortalAccessState; newEmail: string; onEmailChange: (value: string) => void; canCorrectEmail: boolean }) {
  const safeMessage = access.conflictClassification === "DIFFERENT_IDENTITY"
    ? "El correo actual pertenece a otra identidad. Para proteger ambas cuentas, ingresa un correo nuevo y confirmado para este postulante."
    : access.conflictClassification === "SAME_IDENTITY_CANDIDATE"
      ? "La evidencia disponible requiere revisión administrativa antes de realizar cambios de acceso."
      : "No existe evidencia suficiente para modificar el acceso de forma automática. Se requiere revisión administrativa.";
  return <>
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h3 className="text-xs font-black uppercase tracking-wide text-slate-600">Postulante</h3>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        <Detail label="Nombre" value={access.applicant?.name} />
        <Detail label="DNI / documento" value={access.applicant?.documentNumber} />
        <Detail label="Correo solicitado" value={access.applicant?.email ?? access.email} />
        <Detail label="Expediente" value={access.applicant?.applicationCode} />
      </dl>
    </section>
    <section className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
      <h3 className="text-xs font-black uppercase tracking-wide text-amber-800">Cuenta detectada</h3>
      <p className="mt-2 leading-5 text-slate-700">La cuenta detectada pertenece a otra identidad.</p>
      <Detail label="Estado" value={accountStatusLabel(access.detectedAccount?.status)} />
    </section>
    <div className="rounded-xl border border-slate-200 p-4">
      <p className="font-bold text-slate-800">Resolución segura</p>
      <p className="mt-1 text-xs leading-5 text-slate-600">{safeMessage}</p>
    </div>
    {canCorrectEmail && <div className="rounded-xl border border-[#E8D09E] bg-[#fdfaf5] p-4">
      <label htmlFor={`portal-access-email-${access.applicant?.applicationCode ?? "application"}`} className="font-bold text-[#7f561e]">Nuevo correo del postulante</label>
      <p className="mt-1 text-xs leading-5 text-slate-600">El correo se valida, se normaliza y se audita antes de habilitar una cuenta nueva.</p>
      <input id={`portal-access-email-${access.applicant?.applicationCode ?? "application"}`} value={newEmail} onChange={(event) => onEmailChange(event.target.value)} type="email" className="mt-3 w-full rounded-lg border border-[#E8D09E] bg-white px-3 py-2" placeholder="correo@ejemplo.com" />
    </div>}
  </>;
}

function AccessStatus({ access }: { access: PortalAccessState }) {
  const Icon = access.status === "ACTIVE" ? CheckCircle2 : access.status === "PENDING_ACTIVATION" ? Clock3 : access.status === "NOT_PROVISIONED" ? KeyRound : AlertTriangle;
  const color = access.status === "ACTIVE" ? "text-emerald-600" : access.status === "PENDING_ACTIVATION" ? "text-amber-600" : "text-slate-600";
  return <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="flex gap-3"><Icon className={color} size={20} /><div><p className="font-bold text-slate-800">{access.status === "ACTIVE" ? "Acceso habilitado" : access.status === "PENDING_ACTIVATION" ? "Activación pendiente" : access.status === "NOT_PROVISIONED" ? "Sin acceso provisionado" : "Estado de acceso"}</p><p className="mt-1 text-xs leading-5 text-slate-600">{access.message}</p>{access.email && <p className="mt-2 text-xs font-medium text-slate-700">Correo: {access.email}</p>}</div></div></div>;
}

function Detail({ label, value }: { label: string; value?: string }) { return <div><dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 break-words font-semibold text-slate-700">{value || "No disponible"}</dd></div>; }
function accountStatusLabel(status?: string) { return status === "ACTIVE" ? "Activo" : status === "PENDING" ? "Pendiente de activación" : status === "INACTIVE" ? "Inactivo" : status; }
function ActionButton({ label, icon: Icon, onClick, loading }: { label: string; icon: typeof KeyRound; onClick: () => void; loading: boolean }) { return <button disabled={loading} onClick={onClick} className="inline-flex items-center gap-2 rounded-lg bg-[#7f561e] px-3 py-2 text-xs font-bold text-white disabled:opacity-60"><Icon size={14} />{loading ? "Procesando..." : label}</button>; }
