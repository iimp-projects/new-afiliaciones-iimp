"use client";
import { MetricsRow } from "./MetricsRow";

export function WorkspaceHeader() {
    return (
        <div className="flex flex-col gap-6 mb-8 relative z-10">
            <div>
                <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                    Expedientes de Afiliación
                    <span className="px-2.5 py-0.5 rounded-full bg-[#C5A059]/10 text-[#C5A059] text-xs font-bold uppercase tracking-widest border border-[#C5A059]/20">Workspace</span>
                </h1>
                <p className="text-sm font-medium text-slate-500 mt-1.5">Gestiona, evalúa y resuelve las solicitudes pendientes.</p>
            </div>
            <MetricsRow />
        </div>
    );
}