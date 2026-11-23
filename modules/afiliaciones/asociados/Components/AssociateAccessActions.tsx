"use client";

import { useState } from "react";
import { CreditCard, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { AssociateAccessDialog } from "./AssociateAccessDialog";

export function AssociateAccessActions({ personId, applicationId, hasPaidPayment }: { personId: number; applicationId?: number; hasPaidPayment: boolean }) {
  const [managerOpen, setManagerOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const resendPaymentConfirmation = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/afiliaciones/asociados/person/${personId}/resend-payment-confirmation`, { method: "POST" });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.message);
      toast.success(body.message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible reenviar la confirmación.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-black uppercase tracking-widest text-slate-400">Acciones de acceso y correos</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => setManagerOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-[#E6C982] bg-[#FFF8E8] px-3 py-2 text-xs font-bold text-[#936B2E] hover:bg-[#F7ECD7]">
          <KeyRound size={14} /> Gestionar acceso al portal
        </button>
        {hasPaidPayment && (
          <button type="button" disabled={loading} onClick={() => void resendPaymentConfirmation()} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            <CreditCard size={14} /> {loading ? "Enviando..." : "Reenviar confirmación de pago"}
          </button>
        )}
      </div>
      {managerOpen && (
        <AssociateAccessDialog personId={personId} applicationId={applicationId} open onClose={() => setManagerOpen(false)} />
      )}
    </div>
  );
}
