"use client";

import { Code2, X } from "lucide-react";
import type { PaymentConfigurationHealth } from "../Services/PaymentConfigurationHealthService";

export function PaymentTechnicalDetailsModal({ health, onClose }: { health: PaymentConfigurationHealth; onClose: () => void }) {
  return <div className="fixed inset-0 z-[100] flex justify-end bg-slate-950/45 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="payment-technical-title">
    <aside className="h-full w-full max-w-md overflow-auto bg-white p-6 shadow-2xl">
      <div className="flex items-start justify-between"><div className="flex gap-3"><div className="rounded-xl bg-slate-100 p-2 text-slate-700"><Code2 size={20}/></div><div><h2 id="payment-technical-title" className="text-lg font-black text-slate-800">Detalles técnicos</h2><p className="mt-1 text-xs leading-5 text-slate-500">Información de diagnóstico disponible solo para Super Admin.</p></div></div><button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Cerrar"><X size={20}/></button></div>
      <dl className="mt-7 space-y-3"><div className="rounded-xl bg-slate-50 p-3"><dt className="text-[11px] font-black uppercase tracking-wide text-slate-400">Entorno</dt><dd className="mt-1 text-sm font-bold text-slate-700">{health.environment}</dd></div>{health.checks.map((check) => <div key={check.key} className="rounded-xl border border-slate-100 p-3"><dt className="text-sm font-bold text-slate-700">{check.label}</dt><dd className="mt-1 text-xs text-slate-500">Origen: {check.source === "SYSTEM_SETTING" ? "configuración administrada" : check.source === "TEST_FALLBACK" ? "valor temporal de pruebas" : "pendiente"}</dd><dd className="mt-1 font-mono text-[11px] text-slate-400">{check.key}</dd></div>)}</dl>
    </aside>
  </div>;
}
