"use client";

import React from "react";
import { ApplicationStatusData } from "../Models/ApplicationStatus";

interface Props {
  data: ApplicationStatusData;
}

export const StatusRejected: React.FC<Props> = ({ data }) => {
  return (
    <div className="space-y-6">
      <div className="p-4 bg-red-50 border border-red-200/80 rounded-xl flex items-start gap-3">
        <div className="w-7 h-7 rounded-full bg-red-600 text-white flex items-center justify-center text-sm font-bold shrink-0">
          ✕
        </div>
        <div>
          <h4 className="text-sm font-bold text-red-900">
            Solicitud No Aprobada
          </h4>
          <p className="text-xs text-red-800/90 mt-0.5">
            Lamentamos informarle que su solicitud no cumple con los criterios vigentes exigidos por el Estatuto del IIMP.
          </p>
        </div>
      </div>

      <div className="p-4 bg-[#F4F5F7] rounded-xl border border-slate-200 space-y-2">
        <span className="text-[11px] font-bold text-[#3E3E3D] uppercase tracking-wider block">
          Motivo expresado por el Comité:
        </span>
        <p className="text-xs text-slate-600 leading-relaxed">
          {data.rejectionReason || "No cumple con los años mínimos de experiencia profesional comprobable en el sector minero exigidos para la categoría postulada."}
        </p>
      </div>
    </div>
  );
};