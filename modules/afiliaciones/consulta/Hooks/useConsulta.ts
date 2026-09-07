"use client";
import { useState } from "react";
import { queryApi } from "../Services/QueryApi";
import type { QueryChallenge } from "../Services/QueryApi";
import type { ApplicationStatusData, ConsultationQuery } from "../Models/ApplicationStatus";
import { resolveApplicationAction, type AuthorizedApplicationSummary } from "@/modules/afiliaciones/postulacion/Models/ApplicationAction";

export function useConsulta() {
  const [loading, setLoading] = useState(false);
  const [statusData, setStatusData] = useState<ApplicationStatusData | null>(null);
  const [challenge, setChallenge] = useState<QueryChallenge | null>(null);
  const [error, setError] = useState("");
  const handleConsult = async (query: ConsultationQuery) => {
    setLoading(true); setError(""); setStatusData(null);
    try { setChallenge(await queryApi.lookup(query)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo preparar la consulta."); }
    finally { setLoading(false); }
  };
  const loadApplication = async (application: AuthorizedApplicationSummary) => {
    setStatusData(await queryApi.detail(application.id)); setChallenge(null);
  };
  const handleRefresh = async () => {
    if (!statusData?.id) return;
    setLoading(true);
    try { setStatusData(await queryApi.detail(Number(statusData.id))); }
    catch (cause) { setStatusData(null); setError(cause instanceof Error ? cause.message : "Verifica tu identidad nuevamente."); }
    finally { setLoading(false); }
  };
  return { loading, statusData, setStatusData, handleConsult, handleRefresh, challenge, setChallenge, error, loadApplication, currentStatus: statusData?.status, notice: resolveApplicationAction(statusData?.status || null, "CONSULTA", statusData?.canStartNew) };
}
