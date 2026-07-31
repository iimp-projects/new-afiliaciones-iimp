import { MoreHorizontal, Paperclip, Clock, ShieldCheck } from "lucide-react";
import type { ExpedienteDTO } from "../Entities/ExpedienteDTO";
import { StatusBadge } from "./StatusBadge";
import { WorkflowStepper } from "./WorkflowStepper";

export function ExpedienteCard({ data }: { data: ExpedienteDTO }) {
    const initials = data.fullName.split(' ').map(n => n[0]).slice(0, 2).join('');
    
    return (
        <div className="group bg-white border border-slate-200 hover:border-[#C5A059]/50 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col gap-4 relative">
            {/* Action Menu (Aparece en Hover) */}
            <button className="absolute top-3 right-3 p-1.5 text-slate-300 opacity-0 group-hover:opacity-100 group-hover:text-slate-600 hover:bg-slate-100 rounded-md transition-all">
                <MoreHorizontal size={16} />
            </button>

            {/* Cabecera (Avatar y Título) */}
            <div className="flex gap-3 items-start pr-6">
                <div className="w-10 h-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500 font-black text-sm shrink-0">
                    {initials}
                </div>
                <div className="flex flex-col overflow-hidden">
                    <span className="font-extrabold text-slate-800 truncate text-sm" title={data.fullName}>
                        {data.fullName}
                    </span>
                    <span className="text-[11px] font-bold text-slate-400 mt-0.5 font-mono">
                        {data.applicationCode} • {data.documentType} {data.documentNumber}
                    </span>
                </div>
            </div>

            {/* Estado y Workflow */}
            <div className="flex flex-col gap-2.5">
                <div className="flex justify-between items-center">
                    <StatusBadge status={data.status} />
                    <span className="text-[10px] font-black uppercase text-slate-400">
                        Paso {data.currentStep}/5
                    </span>
                </div>
                <WorkflowStepper currentStep={data.currentStep} status={data.status} />
            </div>

            {/* Metadatos (Footer de la Card) */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-slate-400">
                <div className="flex gap-3">
                    <span className="flex items-center gap-1 text-[11px] font-medium" title="Documentos adjuntos">
                        <Paperclip size={12} /> 4/4
                    </span>
                    <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600" title="Validación de Identidad">
                        <ShieldCheck size={12} /> Ok
                    </span>
                </div>
                <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider">
                    <Clock size={10} /> Hoy
                </span>
            </div>
        </div>
    );
}