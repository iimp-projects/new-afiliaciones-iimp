"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BadgeCheck, CreditCard, Info, Upload, X } from "lucide-react";

interface Amounts {
  registrationAmount: number;
  membershipFeeAmount: number;
  totalAmount: number;
  currency: "PEN";
}

interface Props {
  open: boolean;
  applicationId: number | null;
  onClose: () => void;
  onRegistered: (warnings: string[]) => void;
}

const inputClass = "h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059]";
const money = (value: number) => new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(value);
const today = () => new Date().toISOString().slice(0, 10);

export function ManualPaymentModal({ open, applicationId, onClose, onRegistered }: Props) {
  const [loading, setLoading] = useState(false);
  const [eligibility, setEligibility] = useState<{ eligible: boolean; alreadyPaid: boolean; status: string; amounts: Amounts } | null>(null);
  const [method, setMethod] = useState("BANK_TRANSFER");
  const [reference, setReference] = useState("");
  const [paidAt, setPaidAt] = useState(today());
  const [comment, setComment] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || !applicationId) return;
    setLoading(true);
    setError(null);
    setEligibility(null);
    setMethod("BANK_TRANSFER");
    setReference("");
    setPaidAt(today());
    setComment("");
    setProof(null);
    void fetch(`/api/afiliaciones/expedientes/${applicationId}/manual-payment`, { cache: "no-store" })
      .then((response) => response.json())
      .then((body) => {
        if (!body.success) throw new Error(body.message);
        setEligibility(body.data);
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "No fue posible consultar el expediente."))
      .finally(() => setLoading(false));
  }, [open, applicationId]);

  const submit = async () => {
    if (!applicationId || !proof) return;
    setSaving(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("method", method);
      form.set("reference", reference);
      form.set("paidAt", paidAt);
      form.set("comment", comment);
      form.set("proof", proof);
      const response = await fetch(`/api/afiliaciones/expedientes/${applicationId}/manual-payment`, { method: "POST", body: form });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message);
      onRegistered(body.data?.warnings ?? []);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No fue posible registrar el pago manual.");
    } finally {
      setSaving(false);
    }
  };

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby="manual-payment-title" className="fixed inset-0 z-[1000000] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-[2px]" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-700"><CreditCard size={19} /></span>
            <div>
              <h2 id="manual-payment-title" className="font-black text-slate-800">Registrar pago manual</h2>
              <p className="mt-0.5 text-xs font-medium text-slate-500">Registra el pago realizado por banco, efectivo u otro medio fuera de la pasarela.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100"><X size={18} /></button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-4">
          <div className="flex gap-2.5 rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs leading-5 text-sky-800">
            <Info size={16} className="mt-0.5 shrink-0 text-sky-600" />
            <p>Usa este registro cuando el postulante pagó fuera de la pasarela (transferencia, depósito o efectivo). Al confirmar: el expediente pasará a <strong>COMPLETADO</strong>, se guardará el comprobante, se creará o activará la cuenta del asociado y se enviarán los correos de activación y confirmación de pago.</p>
          </div>

          {loading && <p className="flex items-center gap-2 text-xs font-semibold text-slate-400"><span className="h-3 w-3 animate-spin rounded-full border-2 border-[#C5A059] border-t-transparent" /> Consultando expediente...</p>}

          {eligibility && (
            <>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400"><BadgeCheck size={14} /> Monto a registrar</p>
                <div className="mt-2 space-y-1 text-sm text-slate-600">
                  <div className="flex justify-between"><span>Inscripción</span><span className="font-semibold">{money(eligibility.amounts.registrationAmount)}</span></div>
                  <div className="flex justify-between"><span>Cuota de afiliación</span><span className="font-semibold">{money(eligibility.amounts.membershipFeeAmount)}</span></div>
                  <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 text-base font-black text-slate-800"><span>Total</span><span>{money(eligibility.amounts.totalAmount)}</span></div>
                </div>
              </div>

              {!eligibility.eligible && (
                <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">
                  {eligibility.alreadyPaid ? "Este expediente ya tiene un pago registrado." : `El expediente está en estado ${eligibility.status} y no está apto para pago.`}
                </p>
              )}

              {eligibility.eligible && (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Medio de pago
                      <select className={inputClass} value={method} onChange={(event) => setMethod(event.target.value)}>
                        <option value="BANK_TRANSFER">Transferencia / depósito bancario</option>
                        <option value="CASH">Efectivo</option>
                        <option value="UNKNOWN">Otro medio</option>
                      </select>
                    </label>
                    <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Fecha de pago
                      <input type="date" className={inputClass} value={paidAt} max={today()} onChange={(event) => setPaidAt(event.target.value)} />
                    </label>
                    <label className="grid gap-1.5 text-sm font-semibold text-slate-700 sm:col-span-2">Número de operación / referencia
                      <input className={inputClass} value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Ej. 00123456" />
                    </label>
                    <label className="grid gap-1.5 text-sm font-semibold text-slate-700 sm:col-span-2">Comentario
                      <textarea className="min-h-[80px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059]" maxLength={1000} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Observaciones del pago (opcional)" />
                    </label>
                  </div>

                  <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4">
                    <p className="text-sm font-bold text-slate-700">Comprobante de pago <span className="text-red-500">*</span></p>
                    <p className="mt-1 text-xs text-slate-500">PDF, JPG, PNG o WEBP de hasta 10 MB.</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-lg border border-[#E6C982] bg-[#FFF8E8] px-3 py-2 text-xs font-bold text-[#936B2E] hover:bg-[#F7ECD7]"><Upload size={13} /> {proof ? "Cambiar archivo" : "Adjuntar comprobante"}</button>
                      {proof && <span className="truncate text-xs font-semibold text-emerald-700">{proof.name}</span>}
                    </div>
                    <input ref={fileRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => setProof(event.target.files?.[0] ?? null)} />
                  </div>
                </>
              )}
            </>
          )}

          {error && <p role="alert" className="text-sm font-semibold text-red-700">{error}</p>}
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100">Cancelar</button>
          <button type="button" disabled={saving || loading || !eligibility?.eligible || !reference.trim() || !proof} onClick={() => void submit()} className="rounded-xl bg-[#172a45] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
            {saving ? "Registrando..." : "Registrar pago y completar"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
