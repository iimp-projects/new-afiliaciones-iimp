"use client";

import React from "react";
import { ApplicationStatusData, AreaStatusType } from "../Models/ApplicationStatus";


interface Props {
  data: ApplicationStatusData;
}

export const StatusInReview: React.FC<Props> = ({ data }) => {


  const getStatusBadge = (status?: AreaStatusType, customText?: string) => {
    switch (status) {
      case "APPROVED":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
            {customText || "Aprobado"}
          </span>
        );
      case "OBSERVED":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
            {customText || "Observado"}
          </span>
        );
      case "REJECTED":
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
            {customText || "Rechazado"}
          </span>
        );
      case "PENDING":
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            {customText || "Pendiente"}
          </span>
        );
    }
  };

  // Safe extraction con fallbacks para evitar subrayados rojos de TypeScript
  const areas = (data as any)?.areas || {};
  const sponsors = areas.sponsors || { status: "PENDING", approvedCount: 0, requiredCount: 2 };
  const associates = areas.associates || { status: "PENDING" };
  const logistics = areas.logistics || { status: "PENDING" };
  const legal = areas.legal;
  const board = areas.board || { status: "PENDING" };
  const payment = areas.payment || { status: "PENDING" };

  return (
    <div className="space-y-6">
      {/* Lista de Áreas Evaluadoras */}
      <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl bg-white overflow-hidden shadow-sm">

        {/* 1. AVALES */}
        <div className="p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-800">Avales</span>
            </div>
            {(() => {
              const approvedCount = sponsors?.approvedCount ?? 0;
              const requiredCount = sponsors?.requiredCount ?? 2;
              const realStatus = approvedCount >= requiredCount ? "APPROVED" : (sponsors?.status === "OBSERVED" ? "OBSERVED" : "PENDING");

              if (realStatus === "APPROVED") {
                return getStatusBadge("APPROVED", "Aprobado");
              }

              if (realStatus === "OBSERVED") {
                return getStatusBadge("OBSERVED", "Observado");
              }

              return getStatusBadge("PENDING", `Pendiente (${approvedCount} de ${requiredCount})`);
            })()}
          </div>


        </div>

        {/* 2. ASOCIADOS */}
        <div className="p-4 flex items-center justify-between">
          <span className="text-sm font-bold text-slate-800">Área de Asociados</span>
          {getStatusBadge(associates.status)}
        </div>

        {/* 3. LOGÍSTICA */}
        <div className="p-4 flex items-center justify-between">
          <span className="text-sm font-bold text-slate-800">Área de Logística</span>
          {getStatusBadge(logistics.status)}
        </div>

        {/* 4. LEGAL */}
        {legal && logistics.status === "OBSERVED" && (
          <div className="p-4 flex items-center justify-between bg-slate-50">
            <div>
              <span className="text-sm font-bold text-slate-800">Asesoría Legal</span>
              <p className="text-[11px] text-slate-500">Activado por observación logística</p>
            </div>
            {getStatusBadge(legal.status)}
          </div>
        )}

        {/* 5. DIRECTORIO / COMITÉ */}
        <div className="p-4 flex items-center justify-between bg-slate-50/50">
          <div>
            <span className="text-sm font-bold text-slate-800">Directorio / Comité</span>
            <p className="text-[11px] text-slate-500">Revisión final tras aprobación de áreas</p>
          </div>
          {getStatusBadge(board.status)}
        </div>

        {/* 6. PAGO */}
        <div className="p-4 flex items-center justify-between bg-slate-50/50">
          <span className="text-sm font-bold text-slate-800">Pago de Incorporación</span>
          {getStatusBadge(payment.status)}
        </div>
      </div>
    </div>
  );
};