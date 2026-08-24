import React from "react";
import { CheckCircle2, Clock, XCircle, MinusCircle, AlertCircle } from "lucide-react";

export const formatStatusName = (status?: string) => {
  if (!status) return "";
  const normalizedStatus = status.toUpperCase().trim();
  const statusMap: Record<string, string> = {
    DRAFT: "Borrador",
    PENDING: "Pendiente",
    UNDER_EVALUACION: "En Evaluación",
    UNDER_EVALUATION: "En Evaluación",
    OBSERVED: "Observado",
    RESOLVED: "Subsanado",
    READY_FOR_PAYMENT: "Apto para Pago",
    COMPLETED: "Completado",
    REJECTED: "Rechazado",
    APPROVED: "Aprobado",
  };
  return statusMap[normalizedStatus] || status.replace(/_/g, " ");
};

export const getDepartmentLabelByRole = (roleSlug?: string) => {
  if (!roleSlug) return "Asociados";
  switch (roleSlug.toUpperCase()) {
    case "LOGISTICA": return "Logística";
    case "ATENCION_ASOCIADO": return "Asociados";
    case "COMITE_EVALUADOR": return "Comité";
    default: return "Asociados";
  }
};

export const getDocumentFriendlyName = (category?: string) => {
  switch (category) {
    case "ID_DOCUMENT": return "Documento de Identidad (DNI / CE / Pasaporte)";
    case "SWORN_DECLARATION": return "Declaración Jurada Firmada";
    case "CV": return "Currículum Vitae (CV)";
    case "RECOMMENDATION_LETTER": return "Carta de Recomendación";
    case "DEGREE_CERTIFICATE": return "Certificado Académico";
    case "PAYMENT_VOUCHER": return "Voucher o Comprobante de Pago";
    default: return "Constancia de Estudios / Documento Adicional";
  }
};

export const DrawerStatusIcon = ({ status, className = "" }: { status?: string; className?: string }) => {
  if (!status) return null;
  if (status === "check" || status === "APPROVED") return <CheckCircle2 size={14} className={className} strokeWidth={2.5} />;
  if (status === "pending" || status === "clock" || status === "UNDER_EVALUATION" || status === "UNDER_EVALUACION") return <Clock size={14} className={className} strokeWidth={2.5} />;
  if (status === "error" || status === "REJECTED") return <XCircle size={14} className={className} strokeWidth={2.5} />;
  if (status === "dash" || status === "PENDING") return <MinusCircle size={14} className={className} strokeWidth={2.5} />;
  if (status === "review" || status === "OBSERVED") return <AlertCircle size={14} className={className} strokeWidth={2.5} />;
  return null;
};

export const DataField = ({ label, value, fullWidth = false }: { label: string; value: any; fullWidth?: boolean }) => (
  <div className={`flex flex-col gap-1 ${fullWidth ? "sm:col-span-2 lg:col-span-3" : ""}`}>
    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</span>
    <span className="text-[13px] font-semibold text-slate-800">
      {value || <span className="text-slate-300 italic font-medium">No registrado</span>}
    </span>
  </div>
);

// AQUÍ ESTÁ EL ICONO QUE DABA ERROR
export const LayoutList = ({ size, className }: { size: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <line x1="14" y1="4" x2="21" y2="4" />
    <line x1="14" y1="9" x2="21" y2="9" />
    <line x1="14" y1="15" x2="21" y2="15" />
    <line x1="14" y1="20" x2="21" y2="20" />
  </svg>
);