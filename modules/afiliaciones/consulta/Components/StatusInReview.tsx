"use client";

import React, { useState } from "react";
import { ApplicationStatusData, AreaStatusType } from "../Models/ApplicationStatus";
import { SponsorLookupForm, MemberData } from "./SponsorLookupForm";

interface Props {
  data: ApplicationStatusData;
  applicationId?: number | string;
  onRefresh?: () => void;
}

export const StatusInReview: React.FC<Props> = ({ data, applicationId, onRefresh }) => {
  const [hasSubmittedReplacement, setHasSubmittedReplacement] = useState(false);

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

  // DINÁMICO: Obtener los DNIs de los avales asignados
  const blockedDnis: string[] =
    (data as any)?.existingSponsorDnis ||
    (sponsors as any)?.items?.map((s: any) => s.dni).filter(Boolean) ||
    [];

  const handleRegisterNewSponsor = async (sponsor: MemberData) => {
    try {
      // Búsqueda profunda para resolver el ID de la solicitud
      const resolvedAppId =
        applicationId ||
        (data as any)?.id ||
        (data as any)?.applicationId ||
        (data as any)?.application_id ||
        (data as any)?.application?.id ||
        (data as any)?.membershipApplication?.id;

      // Resolver ID de la persona aval
      const resolvedPersonId =
        sponsor.personId ||
        (sponsor as any)?.person_id ||
        (sponsor as any)?.id;

      console.log("👉 Datos listos para enviar:", {
        application_id: resolvedAppId,
        sponsor_person_id: resolvedPersonId,
        sponsor,
      });

      if (!resolvedAppId) {
        alert("Error: No se encontró el ID del expediente (applicationId).");
        return;
      }

      if (!resolvedPersonId) {
        alert("Error: No se encontró el ID de la persona del aval (personId).");
        return;
      }

      // Consumo de API
      const response = await fetch("/api/consulta/reemplazar-aval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          application_id: Number(resolvedAppId),
          sponsor_person_id: Number(resolvedPersonId),
          sponsor_code: sponsor.iimpCode || (sponsor as any).sponsorCode,
          dni: sponsor.dni,
          status: "PENDING",
        }),
      });

      const resData = await response.json();

      if (!response.ok || !resData.success) {
        throw new Error(resData?.error || "Error al registrar el aval.");
      }

      setHasSubmittedReplacement(true);
      alert(`Se ha registrado a ${sponsor.fullName} como nuevo aval. Su estado está PENDIENTE.`);

      if (onRefresh) {
        onRefresh();
      }
    } catch (error: any) {
      console.error("Error al registrar nuevo aval:", error);
      alert(error.message || "Error al intentar guardar el nuevo aval.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner de Estado General */}
      <div className="bg-amber-50/80 border border-amber-200/60 rounded-xl p-4 flex items-start gap-3">
        <div className="p-2 bg-amber-100 text-amber-800 rounded-lg shrink-0">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <h4 className="text-sm font-bold text-amber-900">En Evaluación</h4>
          <p className="text-xs text-amber-800 mt-0.5">
            Su expediente está siendo revisado en paralelo por las áreas correspondientes.
          </p>
        </div>
      </div>

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

              if (hasSubmittedReplacement) {
                return getStatusBadge("PENDING", "1 de 2 Aprobados (Reemplazo enviado)");
              }

              if (realStatus === "APPROVED") {
                return getStatusBadge("APPROVED", "Aprobado");
              }

              if (realStatus === "OBSERVED") {
                return getStatusBadge("OBSERVED", "Observado");
              }

              return getStatusBadge("PENDING", `Pendiente (${approvedCount} de ${requiredCount})`);
            })()}
          </div>

          {/* Formulario / Notificación de reemplazo */}
          {sponsors?.status === "OBSERVED" && (
            <div className="mt-3">
              {hasSubmittedReplacement ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800 font-medium flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>
                    El reemplazo de aval ha sido enviado correctamente y se encuentra <strong>PENDIENTE</strong> de revisión por parte del nuevo asociado.
                  </span>
                </div>
              ) : (
                <>
                  <div className="mb-3 text-xs font-semibold text-amber-900 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                    ⚠️ Uno de sus avales ha rechazado la solicitud. Ingrese el DNI de un nuevo asociado activo hábil.
                  </div>
                  <SponsorLookupForm
                    excludedDnis={blockedDnis}
                    onSubmitSponsor={handleRegisterNewSponsor}
                  />
                </>
              )}
            </div>
          )}
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