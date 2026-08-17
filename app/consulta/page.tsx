"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ConsultationForm } from "@/modules/afiliaciones/consulta/Components/ConsultationForm";
import { ApplicationStatusData, ConsultationQuery } from "@/modules/afiliaciones/consulta/Models/ApplicationStatus";
import { StatusInReview } from "@/modules/afiliaciones/consulta/Components/StatusInReview";
import { StatusObserved } from "@/modules/afiliaciones/consulta/Components/StatusObserved";
import { StatusApproved } from "@/modules/afiliaciones/consulta/Components/StatusApproved";
import { StatusRejected } from "@/modules/afiliaciones/consulta/Components/StatusRejected";

export default function ConsultaPage() {
  const [loading, setLoading] = useState(false);
  const [statusData, setStatusData] = useState<ApplicationStatusData | null>(null);
  const [lastQuery, setLastQuery] = useState<ConsultationQuery | null>(null);

  const handleConsult = async (query: ConsultationQuery) => {
    setLoading(true);
    setLastQuery(query);

    try {
      const response = await fetch(
        `/api/consulta?documentType=${query.documentType}&documentNumber=${query.documentNumber}&code=${query.verificationCode}`
      );

      if (response.ok) {
        const data = await response.json();
        console.log("📊 DATOS REALES DE CONSULTA:", data);
        
        const realId = data.id || data.applicationId || data.application_id;
        
        setStatusData({
          ...data,
          id: realId,
          applicationId: realId,
        });
      } else {
        alert("No se encontró ninguna solicitud con los datos ingresados.");
        setStatusData(null);
      }
    } catch (error) {
      console.error("Error consultando la API real:", error);
      alert("Ocurrió un error al consultar la solicitud.");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    if (lastQuery) {
      handleConsult(lastQuery);
    }
  };

  const getNormalizedStatus = (status?: string) => {
    if (!status) return "IN_REVIEW";
    const upper = status.toUpperCase();

    if (
      [
        "SUBMITTED",
        "IN_REVIEW",
        "PENDING",
        "EN_REVISION",
        "REVISADO",
        "UNDER_EVALUACION",
        "UNDER_EVALUATION",
      ].includes(upper)
    ) {
      return "IN_REVIEW";
    }

    if (["OBSERVED", "OBSERVADO", "OBSERVADA"].includes(upper)) return "OBSERVED";
    if (["APPROVED", "APROBADO", "APROBADA"].includes(upper)) return "APPROVED";
    if (["REJECTED", "RECHAZADO", "RECHAZADA"].includes(upper)) return "REJECTED";

    return "IN_REVIEW";
  };

  const currentStatus = getNormalizedStatus(statusData?.status);

  return (
    <main className="relative min-h-screen w-full flex flex-col justify-between items-center py-10 px-4 bg-[#F4F5F7]">
      <div
        className="absolute inset-0 z-0 bg-cover bg-center opacity-10 mix-blend-multiply pointer-events-none"
        style={{ backgroundImage: "url('/images/minero.jpg')" }}
      />
      
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-[#C39254]/15 to-transparent pointer-events-none blur-3xl" />

      <header className="relative z-10 text-center max-w-lg mx-auto mt-2">
        <Link href="/login" className="inline-block transition-transform hover:scale-105 mb-3">
          <div className="w-20 h-20 mx-auto flex items-center justify-center bg-white rounded-2xl p-3 shadow-md border border-[#C39254]/20">
            <img
              src="https://s3-iimp-gestor-de-archivos-v3.s3.sa-east-1.amazonaws.com/boletines/images/IMG20260807_140143.jpg"
              alt="Logo IIMP"
              className="w-full h-full object-contain"
            />
          </div>
        </Link>
        
        <div>
          <span className="inline-block px-3.5 py-1 rounded-full bg-[#C39254]/15 border border-[#C39254]/30 text-[#8C622C] text-[11px] font-bold uppercase tracking-wider mb-2">
            Portal Oficial de Afiliaciones
          </span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-extrabold text-[#3E3E3D] tracking-tight">
          Consulta de Solicitud
        </h1>
        <p className="text-sm text-[#3E3E3D]/80 mt-1.5 font-normal max-w-sm mx-auto">
          Ingrese sus datos de verificación para consultar el estado actual de su trámite de incorporación.
        </p>
      </header>

      <section className="relative z-10 w-full max-w-xl my-auto pt-6 pb-4">
        {!statusData ? (
          <ConsultationForm onSubmit={handleConsult} loading={loading} />
        ) : (
          <div className="w-full bg-white rounded-2xl p-6 sm:p-8 shadow-xl border border-slate-200/80">
            {currentStatus === "IN_REVIEW" && (
              <StatusInReview 
                data={statusData} 
                applicationId={statusData?.id || statusData?.applicationId || 101} 
              />
            )}

            {currentStatus === "OBSERVED" && (
              <StatusObserved 
                data={statusData as any} 
                onUploadSuccess={handleRefresh} 
              />
            )}

            {currentStatus === "APPROVED" && (
              <StatusApproved 
                data={statusData} 
                onProceedPayment={() => alert("Redirigiendo a pasarela de pagos...")} 
              />
            )}

            {currentStatus === "REJECTED" && (
              <StatusRejected data={statusData} />
            )}

            <div className="text-center mt-6 pt-5 border-t border-slate-100">
              <button
                onClick={() => setStatusData(null)}
                className="inline-flex items-center gap-2 text-xs text-[#C39254] hover:text-[#A1743B] font-bold transition-colors"
              >
                ← Realizar otra consulta
              </button>
            </div>
          </div>
        )}
      </section>

      <footer className="relative z-10 text-center pb-2">
        <a
          href="mailto:liset.otoya@iimp.org.pe"
          className="text-xs text-[#3E3E3D] hover:text-[#C39254] transition-colors inline-flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-slate-200/80 shadow-sm"
        >
          <svg className="w-4 h-4 text-[#C39254]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          ¿Necesita ayuda? Contacte soporte institucional
        </a>
      </footer>
    </main>
  );
}