"use client";

import { Activity, CheckCircle2, AlertCircle } from "lucide-react";
import { formatStatusName } from "../../../Utils/expedientes.utils";

export function HistorialTab({ payload }: { payload: any }) {
  const generateTimeline = () => {
    const events: any[] = [];

    if (payload.createdAt) events.push({ date: new Date(payload.createdAt), title: "Expediente Creado", desc: "El postulante inició su registro.", icon: <Activity size={14} />, color: "bg-slate-100 text-slate-500 border-slate-200" });
    if (payload.submittedAt) events.push({ date: new Date(payload.submittedAt), title: "Expediente Enviado", desc: "Formulario enviado a revisión.", icon: <CheckCircle2 size={14} />, color: "bg-blue-100 text-blue-600 border-blue-200" });

    payload.history?.forEach((h: any) => {
      let auditorInfo = null;
      let cleanDesc = h.changeReason || "Actualización de fase realizada por el sistema.";
      const match = cleanDesc.match(/\[Por:\s(.*?)\s-\s(.*?)\]/);
      if (match) {
        auditorInfo = `${match[1]} (${match[2].replace("_", " ")})`;
        cleanDesc = cleanDesc.replace(match[0], "").trim();
      }
      events.push({
        date: new Date(h.createdAt),
        title: `Cambio de Estado: ${formatStatusName(h.newStatus)}`,
        desc: cleanDesc,
        auditor: auditorInfo,
        icon: <Activity size={14} />,
        color: ["APPROVED", "COMPLETED", "READY_FOR_PAYMENT"].includes(h.newStatus) ? "bg-emerald-100 text-emerald-600 border-emerald-200" : h.newStatus === "REJECTED" ? "bg-red-100 text-red-600 border-red-200" : "bg-amber-100 text-amber-600 border-amber-200",
      });
    });

    payload.observations?.forEach((obs: any) => {
      events.push({
        date: new Date(obs.createdAt),
        title: `Observación Registrada`,
        desc: "Se ha registrado una observación. Revisa la pestaña 'Observaciones' para ver el detalle y la evidencia adjunta.",
        auditor: obs.reviewDepartment, 
        icon: <AlertCircle size={14} />,
        color: "bg-amber-100 text-amber-600 border-amber-200",
      });
    });

    return events.sort((a, b) => b.date.getTime() - a.date.getTime());
  };

  const timelineEvents = generateTimeline();

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
      <h3 className="text-[15px] font-black text-slate-800 mb-8 flex items-center gap-3 border-b border-slate-100 pb-3">
        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
          <Activity size={16} className="text-slate-600" />
        </div>
        Historial de Auditoría
      </h3>

      <div className="relative border-l-2 border-slate-100 ml-4 space-y-8 pb-4 max-h-[600px] overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-slate-200">
        {timelineEvents.map((event, i) => (
          <div key={i} className="relative pl-8">
            <div className={`absolute -left-[17px] top-1 w-8 h-8 rounded-full border-4 border-white flex items-center justify-center shadow-sm ${event.color}`}>
              {event.icon}
            </div>
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1.5">
              <h4 className="text-sm font-bold text-slate-800">{event.title}</h4>
              <span className="text-[11px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md w-max">
                {event.date.toLocaleString("es-PE", { dateStyle: "long", timeStyle: "short" })}
              </span>
            </div>

            {event.auditor && (
              <span className="inline-block mt-1 mb-2 px-2.5 py-1 bg-slate-100 text-slate-600 text-[10px] font-black rounded uppercase border border-slate-200">
                Responsable: <span className="text-[#C5A059]">{event.auditor}</span>
              </span>
            )}

            <p className="text-[13px] font-medium text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">{event.desc}</p>
          </div>
        ))}
        {timelineEvents.length === 0 && <div className="pl-8 text-sm text-slate-400">No hay eventos.</div>}
      </div>
    </div>
  );
}