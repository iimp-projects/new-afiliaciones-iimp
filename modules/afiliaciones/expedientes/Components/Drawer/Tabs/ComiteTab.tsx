import React from "react";
import { Send, Clock, UserCheck, ShieldCheck, MailWarning } from "lucide-react";

export function ComiteTab({ payload }: { payload: any }) {
  // Buscamos el área del comité y su historial
  const comiteValidation = payload?.validations?.find((v: any) => v.department?.code === "COMITE");
  
  // Filtramos solo las acciones de "START_REVIEW" que usamos para guardar el envío de correos
  const notificationHistory = comiteValidation?.history?.filter((h: any) => h.action === "START_REVIEW") || [];

  return (
    <div className="space-y-4 pb-8 animate-in fade-in duration-300">
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 sm:px-5 shadow-sm">
        <h3 className="text-[13px] font-black uppercase tracking-wide text-slate-800">
          Gestión del Comité Evaluador
        </h3>
        <p className="mt-0.5 text-[11px] font-medium text-slate-500">
          Historial de notificaciones enviadas a los ingenieros del comité.
        </p>
      </div>

      <div className="rounded-2xl border border-indigo-100 bg-indigo-50/30 p-5">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck size={18} className="text-indigo-500" />
          <h4 className="text-[12px] font-bold uppercase tracking-widest text-indigo-700">
            Historial de Notificaciones ({notificationHistory.length})
          </h4>
        </div>

        {notificationHistory.length > 0 ? (
          <div className="space-y-3">
            {notificationHistory.map((record: any) => {
              const date = new Date(record.createdAt);
              const dateStr = date.toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
              const timeStr = date.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });

              return (
                <div key={record.id} className="bg-white border border-indigo-100 rounded-xl p-3.5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-500 flex items-center justify-center shrink-0 mt-0.5">
                      <Send size={14} />
                    </div>
                    <div>
                      <p className="text-[12px] font-semibold text-slate-700 leading-snug">
                        {record.comment}
                      </p>
                      <div className="flex items-center gap-3 mt-1.5 text-[10px] font-bold text-slate-400">
                        <span className="flex items-center gap-1"><UserCheck size={12}/> Registrado en sistema</span>
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 sm:text-right bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                    <div className="text-[11px] font-black text-slate-600">{dateStr}</div>
                    <div className="text-[10px] font-bold text-slate-400 flex items-center justify-end gap-1 mt-0.5">
                      <Clock size={10} /> {timeStr}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white border border-dashed border-indigo-200 rounded-xl p-8 flex flex-col items-center justify-center text-center">
            <MailWarning size={32} className="text-indigo-200 mb-3" />
            <p className="text-sm font-bold text-slate-600">Aún no se ha notificado al comité</p>
            <p className="text-xs font-medium text-slate-400 mt-1 max-w-xs">
              El botón de notificación se activará cuando las demás áreas aprueben el expediente.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}