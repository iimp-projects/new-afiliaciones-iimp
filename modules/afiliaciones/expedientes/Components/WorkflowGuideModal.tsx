"use client";

import { createPortal } from "react-dom";
import { FileText, Clock, Activity, Users, UserCheck, Briefcase, ShieldCheck, CreditCard, CheckCircle2, ArrowDown, X, Eye } from "lucide-react";
import { LayoutList } from "../Utils/expedientes.utils"; // Ahora sí se exporta

export const WorkflowGuideModal = ({ onClose }: { onClose: () => void }) => {
  const FlowNode = ({ title, desc, icon: Icon, colorClass, borderClass, isParallel = false }: any) => (
    <div className={`flex flex-col items-center text-center p-4 rounded-xl border-2 ${borderClass} bg-white shadow-sm relative z-10 w-full ${isParallel ? "max-w-[220px]" : "max-w-[300px]"}`}>
      <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 shadow-sm ${colorClass}`}>
        <Icon size={24} className="text-white" strokeWidth={2.5} />
      </div>
      <h4 className="font-black text-slate-800 text-sm mb-1 uppercase tracking-wide">{title}</h4>
      <p className="text-[11px] text-slate-500 font-medium leading-relaxed">{desc}</p>
    </div>
  );

  const Arrow = () => (
    <div className="flex justify-center my-3 animate-pulse opacity-60">
      <ArrowDown size={28} className="text-[#C5A059]" strokeWidth={2.5} />
    </div>
  );

  const ExampleCard = ({ title, states, result, resultColorClass }: any) => (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
      <h5 className="font-black text-slate-700 mb-4 text-xs uppercase tracking-widest border-b border-slate-100 pb-2 flex items-center gap-2">
        <Activity size={14} className="text-[#C5A059]" /> {title}
      </h5>
      <ul className="space-y-2.5 mb-5">
        {states.map((s: any, i: number) => (
          <li key={i} className="flex justify-between items-center text-xs font-medium">
            <span className="text-slate-500">{s.name}</span>
            <span className="text-slate-800 font-black">{s.val}</span>
          </li>
        ))}
      </ul>
      <div className={`text-center py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${resultColorClass}`}>
        <span className="opacity-70">Estado general:</span> <br />
        <span className="text-sm mt-0.5 inline-block">{result}</span>
      </div>
    </div>
  );

  return createPortal(
    <div className="fixed inset-0 z-[999999] bg-slate-900/70 backdrop-blur-sm overflow-y-auto p-4 sm:p-6 lg:p-8 animate-in fade-in">
      <div className="min-h-full flex items-center justify-center">
        <div className="bg-[#f9fafb] rounded-[32px] w-full max-w-5xl shadow-2xl relative overflow-hidden flex flex-col">
          <div className="bg-white px-8 py-6 border-b border-slate-200 flex justify-between items-start sticky top-0 z-50">
            <div>
              <span className="inline-block px-3 py-1 rounded-full bg-[#C5A059]/10 text-[#7f561e] text-[10px] font-black uppercase tracking-widest mb-2 border border-[#C5A059]/20">
                Guía Informativa
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">Flujo de evaluación de afiliaciones</h2>
              <p className="text-sm font-medium text-slate-500 mt-1">Conoce las etapas y validaciones que debe completar una postulación.</p>
            </div>
            <button onClick={onClose} className="p-2.5 bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-500 rounded-full transition-colors focus:outline-none">
              <X size={20} strokeWidth={3} />
            </button>
          </div>

          <div className="p-8">
            <div className="mb-14">
              <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
                <Activity size={20} className="text-[#C5A059]" /> 1. Estructura del Proceso
              </h3>
              <div className="flex flex-col items-center w-full bg-slate-100/50 p-6 sm:p-10 rounded-3xl border border-slate-200/60 shadow-inner">
                <FlowNode title="Postulación" desc="El usuario completa y envía su formulario." icon={FileText} colorClass="bg-slate-400" borderClass="border-slate-200" />
                <Arrow />
                <FlowNode title="Pendiente" desc="Ninguna validación ha iniciado aún." icon={Clock} colorClass="bg-slate-500" borderClass="border-slate-300" />
                <Arrow />
                <FlowNode title="En Evaluación" desc="Se inician las revisiones en paralelo." icon={Activity} colorClass="bg-blue-500" borderClass="border-blue-200" />
                
                <div className="flex justify-center w-full max-w-3xl relative mt-4 mb-2">
                  <div className="w-[66%] h-10 border-t-2 border-l-2 border-r-2 border-[#C5A059]/40 rounded-t-xl animate-pulse"></div>
                </div>

                <div className="flex flex-col lg:flex-row items-start justify-center gap-4 lg:gap-8 w-full relative z-20">
                  <FlowNode title="Avales" desc="Validación de 2 patrocinadores." icon={Users} colorClass="bg-teal-500" borderClass="border-teal-200" isParallel={true} />
                  <FlowNode title="Asociados" desc="Revisión documental." icon={UserCheck} colorClass="bg-teal-500" borderClass="border-teal-200" isParallel={true} />
                  <FlowNode title="Logística" desc="Validación administrativa." icon={Briefcase} colorClass="bg-teal-500" borderClass="border-teal-200" isParallel={true} />
                </div>

                <div className="flex justify-center w-full max-w-3xl relative mt-2 mb-4">
                  <div className="w-[66%] h-10 border-b-2 border-l-2 border-r-2 border-[#C5A059]/40 rounded-b-xl animate-pulse"></div>
                </div>

                <Arrow />
                <FlowNode title="Comité Evaluador" desc="Evaluación final requerida." icon={ShieldCheck} colorClass="bg-[#C5A059]" borderClass="border-[#E8D09E]" />
                <Arrow />
                <FlowNode title="Apto para Pago" desc="Postulación habilitada para pagar." icon={CreditCard} colorClass="bg-emerald-500" borderClass="border-emerald-200" />
                <Arrow />
                <FlowNode title="Completado" desc="El pago fue validado y finaliza el proceso." icon={CheckCircle2} colorClass="bg-emerald-600" borderClass="border-emerald-300" />
              </div>
            </div>

            <hr className="border-slate-100 my-10" />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-10">
              <div>
                <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
                  <LayoutList size={20} className="text-[#C5A059]" /> 2. Estados Generales
                </h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="w-3 h-3 rounded-full bg-slate-400 shrink-0 mt-1"></span>
                    <div>
                      <h6 className="text-sm font-bold text-slate-800">Pendiente</h6>
                      <p className="text-xs text-slate-500 mt-0.5">Postulación enviada, pero ninguna validación ha iniciado.</p>
                    </div>
                  </div>
                  {/* Simplificado para legibilidad */}
                </div>
              </div>
            </div>

            <hr className="border-slate-100 my-10" />

            <div>
              <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
                <Eye size={20} className="text-[#C5A059]" /> 3. Ejemplos de Evaluación
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <ExampleCard title="Ejemplo A" states={[{ name: "Avales", val: "1 de 2 aprobados" }, { name: "Asociados", val: "Aprobado" }, { name: "Logística", val: "En evaluación" }, { name: "Comité", val: "Bloqueado" }]} result="EN EVALUACIÓN" resultColorClass="bg-blue-50 border-blue-200 text-blue-700" />
                <ExampleCard title="Ejemplo B" states={[{ name: "Avales", val: "Aprobado" }, { name: "Asociados", val: "Observado" }, { name: "Logística", val: "Aprobado" }, { name: "Comité", val: "Bloqueado" }]} result="OBSERVADO" resultColorClass="bg-amber-50 border-amber-200 text-amber-700" />
                <ExampleCard title="Ejemplo C" states={[{ name: "Avales", val: "Aprobado" }, { name: "Asociados", val: "Aprobado" }, { name: "Logística", val: "Aprobado" }, { name: "Comité", val: "Aprobado" }, { name: "Pago", val: "Pendiente" }]} result="APTO PARA PAGO" resultColorClass="bg-[#FFFDF8] border-[#E8D09E] text-[#C5A059]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};