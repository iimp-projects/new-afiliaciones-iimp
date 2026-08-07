"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ConsultationForm } from "@/modules/afiliaciones/consulta/Components/ConsultationForm";
import { ApplicationStatusData, ConsultationQuery } from "@/modules/afiliaciones/consulta/Models/ApplicationStatus";
import { StatusInReview } from "@/modules/afiliaciones/consulta/Components/StatusInReview";
import { StatusObserved } from "@/modules/afiliaciones/consulta/Components/StatusObserved";
import { StatusApproved } from "@/modules/afiliaciones/consulta/Components/StatusApproved";
import { StatusRejected } from "@/modules/afiliaciones/consulta/Components/StatusRejected";

// Definimos el tipo de estado localmente para evitar el error de export
type StatusType = "IN_REVIEW" | "OBSERVED" | "APPROVED" | "REJECTED";

export default function ConsultaPage() {
  const [loading, setLoading] = useState(false);
  const [statusData, setStatusData] = useState<ApplicationStatusData | null>(null);

  // Mocks de prueba por estado
  const getMockDataByStatus = (status: StatusType, code: string): ApplicationStatusData => {
    switch (status) {
      case "OBSERVED":
        return {
          status: "OBSERVED",
          applicationCode: code || "APP-2026-9811",
          submissionDate: "02/08/2026",
          observations: [
            "El documento DNI escaneado no presenta la firma visible.",
            "Adjuntar constancia Habilitación CIP vigente."
          ],
          expirationDate: "12/08/2026"
        };
      case "APPROVED":
        return {
          status: "APPROVED",
          applicationCode: code || "APP-2026-9811",
          submissionDate: "01/08/2026",
          evaluationDate: "06/08/2026",
          totalAmount: 500
        };
      case "REJECTED":
        return {
          status: "REJECTED",
          applicationCode: code || "APP-2026-9811",
          submissionDate: "28/07/2026",
          rejectionReason: "El expediente presentado no acredita la experiencia profesional mínima requerida según el Estatuto del IIMP."
        };
      case "IN_REVIEW":
      default:
        return {
          status: "IN_REVIEW",
          applicationCode: code || "APP-2026-9811",
          submissionDate: "05/08/2026"
        };
    }
  };

  const handleConsult = async (query: ConsultationQuery) => {
    setLoading(true);
    setTimeout(() => {
      setStatusData(getMockDataByStatus("IN_REVIEW", query.verificationCode));
      setLoading(false);
    }, 800);
  };

  return (
    <main className="relative min-h-screen w-full flex flex-col justify-between items-center py-10 px-4 bg-[#F4F5F7]">
      {/* Texture Layer */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center opacity-10 mix-blend-multiply pointer-events-none"
        style={{ backgroundImage: "url('/images/minero.jpg')" }}
      />
      
      {/* Primary Resplandor */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-[#C39254]/15 to-transparent pointer-events-none blur-3xl" />

      {/* Header Institucional */}
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

      {/* Contenedor Principal */}
      <section className="relative z-10 w-full max-w-xl my-auto pt-6 pb-4">
        {!statusData ? (
          <ConsultationForm onSubmit={handleConsult} loading={loading} />
        ) : (
          <div className="w-full bg-white rounded-2xl p-6 sm:p-8 shadow-xl border border-slate-200/80">
            
            {statusData.status === "SUBMITTED" || statusData.status === "IN_REVIEW" ? (
              <StatusInReview data={statusData} />
            ) : statusData.status === "OBSERVED" ? (
              <StatusObserved 
                data={statusData} 
                onUploadSuccess={() => alert("Documentación re-enviada")} 
              />
            ) : statusData.status === "APPROVED" ? (
              <StatusApproved 
                data={statusData} 
                onProceedPayment={() => alert("Redirigiendo a pasarela de pagos...")} 
              />
            ) : statusData.status === "REJECTED" ? (
              <StatusRejected data={statusData} />
            ) : null}

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

      {/* BARRA DEV TOOLBAR: Simulador QA */}
      {statusData && (
        <div className="relative z-20 my-4 bg-[#3E3E3D] text-white px-4 py-2 rounded-xl shadow-lg flex flex-wrap items-center justify-center gap-2 text-xs">
          <span className="font-bold text-amber-400 mr-2">Simulador QA:</span>
          <button
            onClick={() => setStatusData(getMockDataByStatus("IN_REVIEW", statusData.applicationCode))}
            className={`px-2.5 py-1 rounded transition-colors ${statusData.status === "IN_REVIEW" ? "bg-[#C39254] font-bold" : "bg-slate-700 hover:bg-slate-600"}`}
          >
            En Evaluación
          </button>
          <button
            onClick={() => setStatusData(getMockDataByStatus("OBSERVED", statusData.applicationCode))}
            className={`px-2.5 py-1 rounded transition-colors ${statusData.status === "OBSERVED" ? "bg-[#C39254] font-bold" : "bg-slate-700 hover:bg-slate-600"}`}
          >
            Observado
          </button>
          <button
            onClick={() => setStatusData(getMockDataByStatus("APPROVED", statusData.applicationCode))}
            className={`px-2.5 py-1 rounded transition-colors ${statusData.status === "APPROVED" ? "bg-[#C39254] font-bold" : "bg-slate-700 hover:bg-slate-600"}`}
          >
            Aprobado
          </button>
          <button
            onClick={() => setStatusData(getMockDataByStatus("REJECTED", statusData.applicationCode))}
            className={`px-2.5 py-1 rounded transition-colors ${statusData.status === "REJECTED" ? "bg-[#C39254] font-bold" : "bg-slate-700 hover:bg-slate-600"}`}
          >
            Rechazado
          </button>
        </div>
      )}

      {/* Footer */}
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