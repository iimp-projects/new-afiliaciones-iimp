"use client";

import React from "react";
import { ApplicationStatusData } from "../Models/ApplicationStatus";

interface Props {
  data: ApplicationStatusData;
  onProceedPayment?: () => void;
}

export const StatusApproved: React.FC<Props> = ({ data, onProceedPayment }) => {
  return (
    <div className="space-y-6">
      {/* Banner de Éxito */}
      <div className="p-4 bg-emerald-50 border border-emerald-200/80 rounded-xl flex items-start gap-3">
        <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-bold shrink-0">
          ✓
        </div>
        <div>
          <h4 className="text-sm font-bold text-emerald-900">
            ¡Solicitud Aprobada por el Comité!
          </h4>
          <p className="text-xs text-emerald-800/90 mt-0.5">
            Su postulación ha sido evaluada satisfactoriamente. Para completar su incorporación e ingresar al padrón de asociados, efectúe el pago correspondiente.
          </p>
        </div>
      </div>

      {/* Desglose de Montos */}
      <div className="bg-[#F4F5F7] p-4 rounded-xl border border-slate-200/80 space-y-3">
        <h5 className="text-xs font-bold text-[#3E3E3D] uppercase tracking-wider">
          Resumen de Afiliación
        </h5>
        
        <div className="space-y-2 text-xs">
          <div className="flex justify-between text-slate-600">
            <span>Derecho de Inscripción:</span>
            <span className="font-semibold text-slate-800">S/ 150.00</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Cuota Anual (Aportación institucional):</span>
            <span className="font-semibold text-slate-800">S/ 150.00</span>
          </div>
          <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-sm text-[#3E3E3D]">
            <span>Total a Pagar:</span>
            <span className="text-[#C39254]">S/ 300.00</span>
          </div>
        </div>
      </div>

      {/* Botón Pasarela */}
      <button
        onClick={onProceedPayment}
        className="w-full h-12 bg-[#C39254] hover:bg-[#B07F43] text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 shadow-md shadow-[#C39254]/20 transition-all"
      >
        <span>💳 Proceder al Pago Seguro</span>
      </button>
    </div>
  );
};