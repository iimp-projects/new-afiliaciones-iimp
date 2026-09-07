"use client";

import { useState } from "react";
import { ApplicationStatusData, ConsultationQuery } from "../Models/ApplicationStatus";

export function useConsulta() {
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

    if (["SUBMITTED", "IN_REVIEW", "PENDING", "EN_REVISION", "REVISADO", "UNDER_EVALUACION", "RESOLVED"].includes(upper)) {
      return "IN_REVIEW";
    }

    if (["OBSERVED", "OBSERVADO"].includes(upper)) return "OBSERVED";
    if (["REJECTED", "RECHAZADO"].includes(upper)) return "REJECTED";
    
    // AQUÍ ESTÁ LA MAGIA: Si está aprobado o listo para pago, mandamos a READY_FOR_PAYMENT
    if (["READY_FOR_PAYMENT", "LISTO_PARA_PAGO", "APPROVED", "APROBADO"].includes(upper)) {
      return "READY_FOR_PAYMENT"; 
    }
    
    // Solo mostramos COMPLETED si ya pagó
    if (["COMPLETED", "FINALIZADO"].includes(upper)) {
      return "COMPLETED";
    }

    return "IN_REVIEW";
  };

  return {
    loading,
    statusData,
    setStatusData,
    handleConsult,
    handleRefresh,
    currentStatus: getNormalizedStatus(statusData?.status)
  };
}