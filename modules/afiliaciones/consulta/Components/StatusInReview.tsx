"use client";

import React from "react";
import { ApplicationStatusData } from "../Models/ApplicationStatus";

interface Props {
  data: ApplicationStatusData;
}

export const StatusInReview: React.FC<Props> = ({ data }) => {
  return (
    <div className="space-y-6">
      {/* Banner Superior */}
      <div className="p-4 bg-amber-50 border border-amber-200/60 rounded-xl flex items-start gap-3">
        <div className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
          i
        </div>
        <div>
          <h4 className="text-sm font-semibold text-amber-900">En Evaluación</h4>
          <p className="text-xs text-amber-800/80 mt-0.5">
            Su solicitud se encuentra en evaluación por el Comité de Afiliaciones. Este proceso puede tomar entre 3 a 5 días hábiles.
          </p>
        </div>
      </div>

      {/* Timeline de Pasos */}
      <div className="pl-2 space-y-6 relative before:absolute before:left-5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
        {/* Step 1 */}
        <div className="flex gap-4 relative">
          <div className="w-7 h-7 rounded-full bg-amber-800 text-white flex items-center justify-center text-xs z-10 shrink-0">
            ✓
          </div>
          <div>
            <h5 className="text-sm font-semibold text-slate-800">Solicitud Recibida</h5>
            <p className="text-xs text-slate-500 mt-0.5">Su documentación ha sido recibida exitosamente por nuestro sistema.</p>
            <span className="text-[11px] text-slate-400 mt-1 block">Completado: {data.submissionDate || "Reciente"}</span>
          </div>
        </div>

        {/* Step 2 */}
        <div className="flex gap-4 relative">
          <div className="w-7 h-7 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs z-10 shrink-0 ring-4 ring-amber-100">
            ⏳
          </div>
          <div>
            <h5 className="text-sm font-semibold text-amber-900">Revisión Técnica</h5>
            <p className="text-xs text-slate-500 mt-0.5">El comité está evaluando los documentos presentados para asegurar que cumplen con los requisitos.</p>
            <span className="inline-block mt-2 px-2.5 py-0.5 bg-amber-100 text-amber-800 rounded-full text-[10px] font-semibold">
              En progreso
            </span>
          </div>
        </div>

        {/* Step 3 */}
        <div className="flex gap-4 relative">
          <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-400 flex items-center justify-center text-xs z-10 shrink-0">
            •
          </div>
          <div>
            <h5 className="text-sm font-medium text-slate-400">Aprobación Final</h5>
            <p className="text-xs text-slate-400 mt-0.5">Resolución final de la directiva y emisión del certificado de afiliación institucional.</p>
            <span className="text-[11px] text-slate-400 mt-1 block">Pendiente</span>
          </div>
        </div>
      </div>
    </div>
  );
};