"use client";
import { Info } from "lucide-react";
import { resolveApplicationAction, type ApplicationContext } from "../Models/ApplicationAction";
export function ApplicationStateNotice({ status, context, canStartNew, onPrimary, onClose, title, description }: { status: string | null; context: ApplicationContext; canStartNew?: boolean; onPrimary?: () => void; onClose?: () => void; title?: string; description?: string }) {
  const notice = resolveApplicationAction(status, context, canStartNew);
  const tone = status === "REJECTED" ? "bg-red-50 text-red-800" : { INFO: "bg-blue-50 text-blue-800", ACTION_REQUIRED: "bg-amber-50 text-amber-800", SUCCESS: "bg-emerald-50 text-emerald-800", WARNING: "bg-amber-50 text-amber-800", FINAL: "bg-emerald-50 text-emerald-800" }[notice.tone];
  return <section className="bg-white rounded-3xl p-8 max-w-xl w-full shadow-xl" role="status">
    <div className={`w-14 h-14 rounded-full grid place-items-center mx-auto mb-5 ${tone}`}><Info /></div>
    <h2 className="text-xl font-bold text-center text-slate-800">{title || notice.title}</h2>
    <p className="text-sm text-slate-600 text-center mt-4">{description || notice.description}</p>
    {notice.badge && <p className="text-center my-5"><span className={`px-4 py-2 rounded-full text-sm font-bold ${tone}`}>{notice.badge}</span></p>}
    <div className="flex flex-col gap-3 mt-6">
      {onPrimary && notice.action !== "UNKNOWN" && <button type="button" onClick={onPrimary} className="h-12 rounded-xl bg-[#C5A059] text-white font-bold">{notice.label}</button>}
      {onClose && <button type="button" onClick={onClose} className="h-12 rounded-xl border border-slate-200 text-slate-600 font-bold">Cerrar</button>}
    </div>
  </section>;
}
