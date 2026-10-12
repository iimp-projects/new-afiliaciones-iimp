"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, GraduationCap, Loader2, Users } from "lucide-react";
import { previewAssociateRecipientsAction, setCampaignRecipientsFromAssociatesAction } from "../Actions/campaign.actions";
import type { AssociateRecipientSelection, AssociateSourceFilter } from "../Models/AssociateRecipient";

const FILTERS: Array<{ value: AssociateSourceFilter; label: string }> = [
  { value: "ALL", label: "Todos los asociados activos y estudiantes" },
  { value: "ACTIVE", label: "Solo asociados activos" },
  { value: "STUDENT", label: "Solo asociados estudiantes" },
];

const REASON_LABEL: Record<string, string> = {
  NO_ACCOUNT: "Sin cuenta vinculada",
  NOT_ELIGIBLE_ACCOUNT: "Cuenta no elegible",
  CONFLICT: "Conflicto de identidad",
  NO_ACCESS_EMAIL: "Sin correo de acceso verificado",
  UNLINKED: "Registro SIE sin vincular",
};

export function AssociatesSourceSection({ campaignId, onApplied }: { campaignId: number; onApplied: () => void }) {
  const [filter, setFilter] = useState<AssociateSourceFilter>("ALL");
  const [selection, setSelection] = useState<AssociateRecipientSelection | null>(null);
  const [busy, setBusy] = useState(false);
  const [applying, setApplying] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const preview = async () => {
    setBusy(true);
    setMessage(null);
    setSelection(null);
    const response = await previewAssociateRecipientsAction(filter);
    setBusy(false);
    if (response.success) setSelection(response.selection);
    else setMessage({ kind: "error", text: response.message });
  };

  const apply = async () => {
    setApplying(true);
    setMessage(null);
    const response = await setCampaignRecipientsFromAssociatesAction(campaignId, filter);
    setApplying(false);
    if (!response.success) {
      setMessage({ kind: "error", text: response.message });
      return;
    }
    setMessage({ kind: "success", text: `Se configuraron ${response.count} destinatarios únicos desde el sistema.` });
    onApplied();
  };

  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center gap-2">
        <GraduationCap size={17} className="text-[#C5A059]" />
        <h3 className="text-sm font-black uppercase tracking-wide text-slate-700">Origen: Asociados del sistema</h3>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Selecciona asociados desde las cuentas de acceso del sistema (activos y estudiantes). El correo de acceso se obtiene de la cuenta verificada.
      </p>

      <div className="mt-4 space-y-2">
        {FILTERS.map((option) => (
          <label key={option.value} className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 p-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <input type="radio" name="associate-filter" checked={filter === option.value} onChange={() => setFilter(option.value)} className="h-4 w-4 accent-[#C5A059]" />
            {option.label}
          </label>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={() => void preview()}
          disabled={busy || applying}
          className="inline-flex items-center gap-2 rounded-xl border border-[#C5A059] px-5 py-2.5 text-sm font-black text-[#7f561e] disabled:opacity-50"
        >
          {busy && <Loader2 size={15} className="animate-spin" />} Previsualizar elegibilidad
        </button>
        <button
          onClick={() => void apply()}
          disabled={applying || busy}
          className="inline-flex items-center gap-2 rounded-xl bg-[#C5A059] px-6 py-2.5 text-sm font-black text-white shadow-md disabled:opacity-50"
        >
          {applying && <Loader2 size={15} className="animate-spin" />} Usar estos asociados
        </button>
      </div>

      {message && (
        <p className={`mt-3 flex items-center gap-2 text-sm font-semibold ${message.kind === "success" ? "text-emerald-700" : "text-red-600"}`}>
          {message.kind === "success" ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />} {message.text}
        </p>
      )}

      {selection && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl bg-emerald-50 p-4">
            <div className="flex items-center gap-2 text-sm font-black text-emerald-800">
              <Users size={15} /> Elegibles
            </div>
            <p className="mt-2 text-3xl font-black text-emerald-700">{selection.totalEligible}</p>
            <p className="text-xs font-semibold text-emerald-600">asociados con cuenta de acceso vinculada</p>
          </div>
          <div className="rounded-2xl bg-amber-50 p-4">
            <div className="flex items-center gap-2 text-sm font-black text-amber-800">
              <AlertTriangle size={15} /> Excluidos para revisión
            </div>
            <p className="mt-2 text-3xl font-black text-amber-700">{selection.totalExcluded}</p>
            <p className="text-xs font-semibold text-amber-600">sin cuenta, conflicto o no elegibles</p>
          </div>

          {selection.excluded.length > 0 && (
            <div className="sm:col-span-2 rounded-2xl border border-slate-200 p-4">
              <p className="text-xs font-bold uppercase text-slate-400">Detalle de excluidos (muestra)</p>
              <div className="mt-2 max-h-56 space-y-1 overflow-y-auto">
                {selection.excluded.map((item, index) => (
                  <div key={`${item.personId ?? item.documentNumber ?? index}`} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-xs">
                    <span className="font-semibold text-slate-700">{item.nombre ?? item.correoContacto ?? "—"}</span>
                    <span className="text-slate-400">{item.documentNumber ?? ""}</span>
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 font-bold text-amber-700">{REASON_LABEL[item.reason] ?? item.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
