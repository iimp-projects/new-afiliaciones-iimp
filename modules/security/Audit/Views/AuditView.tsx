"use client";

import { Activity, Download, Search, Clock, ShieldAlert, MonitorDot, MapPin } from "lucide-react";

export function AuditView({ logs, total }: { logs: any[], total: number }) {
  
  // Función para darle un estilo visual dependiendo de la acción (crear, editar, borrar, login)
  const getActionBadge = (action: string) => {
    const act = action.toUpperCase();
    if (act.includes("CREATE") || act.includes("LOGIN")) return "bg-emerald-50 text-emerald-600 border-emerald-200";
    if (act.includes("DELETE") || act.includes("REVOKE")) return "bg-red-50 text-red-600 border-red-200";
    if (act.includes("UPDATE")) return "bg-amber-50 text-amber-600 border-amber-200";
    return "bg-blue-50 text-blue-600 border-blue-200";
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Auditoría del Sistema</h1>
          <p className="text-sm font-medium text-slate-500 mt-1.5">Registro inmutable de actividades y trazabilidad de los usuarios.</p>
        </div>
        <button className="flex items-center gap-2 bg-white border border-[#C5A059] text-[#C5A059] px-5 h-11 rounded-xl font-bold shadow-sm hover:bg-[#FFFDF8] transition-all text-sm">
          <Download size={16} strokeWidth={2.5} /> Exportar Log Completo
        </button>
      </div>

      {/* ÁREA DE FILTROS TIPO PASTILLA */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-4">
        <div className="relative w-full md:flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar por usuario, acción o entidad..."
            className="w-full h-12 pl-12 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059] transition-all"
          />
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <input type="date" className="h-12 px-4 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 bg-white focus:outline-none focus:border-[#C5A059] w-full md:w-auto" />
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm font-bold text-slate-500 px-2">
        <span className="w-2 h-2 rounded-full bg-[#C5A059] animate-pulse"></span>
        {total} eventos registrados
      </div>

      {/* FEED DE AUDITORÍA (Estilo Moderno en lugar de Tabla) */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="divide-y divide-slate-100">
          {logs.map((log) => {
            const userName = log.user?.person ? `${log.user.person.firstName} ${log.user.person.paternalLastName}` : "Sistema";
            
            return (
              <div key={log.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors group">
                <div className="flex items-start gap-4">
                  {/* Icono de Acción */}
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 shrink-0 border border-slate-200 group-hover:border-[#C5A059] group-hover:text-[#C5A059] transition-colors">
                    <Activity size={18} strokeWidth={2.5} />
                  </div>
                  
                  {/* Contenido Principal */}
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-[13px] font-extrabold text-slate-800">{userName}</span>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${getActionBadge(log.action)}`}>
                        {log.action}
                      </span>
                      <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                        {log.entity}
                      </span>
                    </div>
                    {log.entityId && (
                      <p className="text-[11px] font-medium text-slate-500 mt-0.5">
                        Registro afectado: <span className="font-mono bg-slate-100 px-1 rounded">{log.entityId}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Metadatos (IP, Dispositivo, Hora) */}
                <div className="flex flex-row md:flex-col items-center md:items-end gap-3 md:gap-1 text-[11px] font-bold text-slate-400 shrink-0">
                  <span className="flex items-center gap-1.5"><Clock size={12} /> {new Date(log.createdAt).toLocaleString('es-PE')}</span>
                  {log.ipAddress && <span className="flex items-center gap-1.5 text-slate-400"><MapPin size={12} /> {log.ipAddress}</span>}
                </div>
              </div>
            );
          })}
          
          {logs.length === 0 && (
            <div className="p-12 text-center text-slate-500 flex flex-col items-center">
              <ShieldAlert className="w-12 h-12 text-slate-300 mb-3" />
              <p className="font-bold">No hay registros de auditoría</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}