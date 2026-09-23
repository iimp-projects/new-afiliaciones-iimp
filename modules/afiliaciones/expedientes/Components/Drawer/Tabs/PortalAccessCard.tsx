"use client";
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps -- the protected access summary is refreshed with the selected expediente. */

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, KeyRound } from "lucide-react";
import { PortalAccessManager, type PortalAccessState } from "./PortalAccessManager";

export function PortalAccessCard({ applicationId, completed }: { applicationId: number; completed: boolean }) {
  const [access, setAccess] = useState<PortalAccessState | null>(null);
  const [managerOpen, setManagerOpen] = useState(false);
  const load = async () => { if (!completed) return; const response = await fetch(`/api/afiliaciones/expedientes/${applicationId}/access`); const body = await response.json(); if (response.ok && body.success) setAccess(body.data); };
  useEffect(() => { void load(); }, [applicationId, completed]);
  if (!completed || !access) return null;
  const appearance = access.status === "ACTIVE" ? { icon: CheckCircle2, color: "text-emerald-600", label: "Cuenta activa" } : access.status === "PENDING_ACTIVATION" ? { icon: Clock3, color: "text-amber-600", label: "Activación pendiente" } : access.status === "CONFLICT" ? { icon: AlertTriangle, color: "text-amber-700", label: "Conflicto de cuenta" } : { icon: KeyRound, color: "text-blue-700", label: "Acceso al portal" };
  const Icon = appearance.icon;
  return <div><h3 className="mb-3 text-[13px] font-bold text-slate-800">Acceso al portal</h3><div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="flex items-start gap-3"><Icon size={20} className={appearance.color} /><div className="min-w-0 flex-1"><p className="text-sm font-bold text-slate-800">{appearance.label}</p><p className="mt-1 text-xs leading-5 text-slate-500">{access.message}</p>{access.email && <p className="mt-2 text-xs font-medium text-slate-600">Correo: {access.email}</p>}</div></div><div className="mt-4 flex justify-end"><button onClick={() => setManagerOpen(true)} className="rounded-lg border border-amber-300 px-3 py-2 text-xs font-bold text-amber-800 transition hover:bg-amber-50">{access.status === "CONFLICT" ? "Revisar conflicto" : "Gestionar acceso"}</button></div></div><PortalAccessManager applicationId={applicationId} open={managerOpen} onClose={() => setManagerOpen(false)} onAccessChanged={() => void load()} /></div>;
}
