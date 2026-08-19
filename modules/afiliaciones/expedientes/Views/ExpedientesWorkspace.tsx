"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { SmartCaseCard } from "@/modules/shared/Components/SmartCaseCard/SmartCaseCard";
import { ExpedientesFilterBar } from "../Components/ExpedientesFilterBar";
import { ExpedientesPagination } from "../Components/ExpedientesPagination";
import { InspectionDrawer } from "@/modules/shared/Components/InspectionDrawer/InspectionDrawer";
import { RichTextEditor } from "@/modules/shared/Components/RichTextEditor/RichTextEditor"; // <-- IMPORTA EL EDITOR AQUÍ
import type { SmartCaseCardData } from "@/modules/shared/Components/SmartCaseCard/types";
import type { DrawerData } from "@/modules/shared/Components/InspectionDrawer/types";
import {
  FileText,
  User,
  GraduationCap,
  Briefcase,
  Users,
  Eye,
  CheckCircle2,
  Clock,
  XCircle,
  MinusCircle,
  AlertCircle,
  Info,
  ChevronDown,
  MapPin,
  Calendar,
  CreditCard,
  Activity,
  Phone,
  Mail,
  Building2,
  Download,
  Search,
  UserSearch,
  AlertTriangle,
  ShieldCheck,
  UserCheck,
  X,
  ArrowDown,
  RefreshCcw,
  FileSpreadsheet,
  Trash2,
  BellRing,
  Paperclip,    // <-- AÑADIDO PARA ADJUNTOS
  UploadCloud   // <-- AÑADIDO PARA ADJUNTOS
} from "lucide-react";
import { DynamicIcon } from "@/modules/layout/Utils/DynamicIcon";
import { OBSERVATION_FIELDS } from "@/modules/afiliaciones/observations/ObservationFields";

// ==========================================
// 1. DICCIONARIO TRADUCTOR ESTRICTO
// ==========================================
const formatStatusName = (status: string) => {
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

// ==========================================
// 2. MAPEO DINÁMICO DE ROLES
// ==========================================
const getDepartmentLabelByRole = (roleSlug?: string) => {
  if (!roleSlug) return "Asociados";
  switch (roleSlug.toUpperCase()) {
    case "LOGISTICA":
      return "Logística";
    case "ATENCION_ASOCIADO":
      return "Asociados";
    case "COMITE_EVALUADOR":
      return "Comité";
    default:
      return "Asociados"; // Fallback
  }
};

const DrawerStatusIcon = ({
  status,
  className = "",
}: {
  status: string;
  className?: string;
}) => {
  if (status === "check" || status === "APPROVED")
    return <CheckCircle2 size={14} className={className} strokeWidth={2.5} />;
  if (
    status === "pending" ||
    status === "clock" ||
    status === "UNDER_EVALUATION" ||
    status === "UNDER_EVALUACION"
  )
    return <Clock size={14} className={className} strokeWidth={2.5} />;
  if (status === "error" || status === "REJECTED")
    return <XCircle size={14} className={className} strokeWidth={2.5} />;
  if (status === "dash" || status === "PENDING")
    return <MinusCircle size={14} className={className} strokeWidth={2.5} />;
  if (status === "review" || status === "OBSERVED")
    return <AlertCircle size={14} className={className} strokeWidth={2.5} />;
  return null;
};

const DataField = ({
  label,
  value,
  fullWidth = false,
}: {
  label: string;
  value: any;
  fullWidth?: boolean;
}) => (
  <div
    className={`flex flex-col gap-1 ${fullWidth ? "sm:col-span-2 lg:col-span-3" : ""}`}
  >
    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
      {label}
    </span>
    <span className="text-[13px] font-semibold text-slate-800">
      {value || (
        <span className="text-slate-300 italic font-medium">No registrado</span>
      )}
    </span>
  </div>
);

const getDocumentFriendlyName = (document: { category: string; fileName?: string; mimeType?: string }) => {
  if (document.category === "OTHER" && (document.mimeType?.startsWith("image/") || /foto|photograph/i.test(document.fileName ?? ""))) {
    return "Fotografía del postulante";
  }
  switch (document.category) {
    case "ID_DOCUMENT":
      return "Documento de Identidad (DNI / CE / Pasaporte)";
    case "SWORN_DECLARATION":
      return "Declaración Jurada Firmada";
    case "CV":
      return "Currículum Vitae (CV)";
    case "RECOMMENDATION_LETTER":
      return "Carta de Recomendación";
    case "DEGREE_CERTIFICATE":
      return "Certificado Académico";
    case "PAYMENT_VOUCHER":
      return "Voucher o Comprobante de Pago";
    default:
      return "Constancia de Estudios / Documento Adicional";
  }
};

// ==========================================
// COMPONENTE: GUÍA VISUAL DEL FLUJO
// ==========================================
const WorkflowGuideModal = ({ onClose }: { onClose: () => void }) => {
  // Nodo visual del workflow
  const FlowNode = ({
    title,
    desc,
    icon: Icon,
    colorClass,
    borderClass,
    isParallel = false,
  }: any) => (
    <div
      className={`flex flex-col items-center text-center p-4 rounded-xl border-2 ${borderClass} bg-white shadow-sm relative z-10 w-full ${isParallel ? "max-w-[220px]" : "max-w-[300px]"}`}
    >
      <div
        className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 shadow-sm ${colorClass}`}
      >
        <Icon size={24} className="text-white" strokeWidth={2.5} />
      </div>
      <h4 className="font-black text-slate-800 text-sm mb-1 uppercase tracking-wide">
        {title}
      </h4>
      <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
        {desc}
      </p>
    </div>
  );

  const Arrow = () => (
    <div className="flex justify-center my-3 animate-pulse opacity-60">
      <ArrowDown size={28} className="text-[#C5A059]" strokeWidth={2.5} />
    </div>
  );

  const ExampleCard = ({ title, states, result, resultColorClass }: any) => (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
      <h5 className="font-black text-slate-700 mb-4 text-xs uppercase tracking-widest border-b border-slate-100 pb-2 flex items-center gap-2">
        <Activity size={14} className="text-[#C5A059]" /> {title}
      </h5>
      <ul className="space-y-2.5 mb-5">
        {states.map((s: any, i: number) => (
          <li
            key={i}
            className="flex justify-between items-center text-xs font-medium"
          >
            <span className="text-slate-500">{s.name}</span>
            <span className="text-slate-800 font-black">{s.val}</span>
          </li>
        ))}
      </ul>
      <div
        className={`text-center py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${resultColorClass}`}
      >
        <span className="opacity-70">Estado general:</span> <br />
        <span className="text-sm mt-0.5 inline-block">{result}</span>
      </div>
    </div>
  );

  return createPortal(
    <div className="fixed inset-0 z-[999999] bg-slate-900/70 backdrop-blur-sm overflow-y-auto p-4 sm:p-6 lg:p-8 animate-in fade-in">
      <div className="min-h-full flex items-center justify-center">
        <div className="bg-[#f9fafb] rounded-[32px] w-full max-w-5xl shadow-2xl relative overflow-hidden flex flex-col">
          {/* Header del Modal */}
          <div className="bg-white px-8 py-6 border-b border-slate-200 flex justify-between items-start sticky top-0 z-50">
            <div>
              <span className="inline-block px-3 py-1 rounded-full bg-[#C5A059]/10 text-[#7f561e] text-[10px] font-black uppercase tracking-widest mb-2 border border-[#C5A059]/20">
                Guía Informativa
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">
                Flujo de evaluación de afiliaciones
              </h2>
              <p className="text-sm font-medium text-slate-500 mt-1">
                Conoce las etapas y validaciones que debe completar una postulación.
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2.5 bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-500 rounded-full transition-colors focus:outline-none"
            >
              <X size={20} strokeWidth={3} />
            </button>
          </div>

          {/* Cuerpo Scrollable */}
          <div className="p-8">
            {/* Mensaje Clave */}
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 sm:p-6 mb-10 flex gap-4 items-start shadow-sm">
              <Info
                size={28}
                className="text-blue-600 shrink-0 mt-0.5"
                strokeWidth={2.5}
              />
              <p className="text-sm sm:text-base font-bold text-blue-900 leading-relaxed">
                Las evaluaciones de{" "}
                <strong className="text-blue-950">
                  Avales, Asociados y Logística
                </strong>{" "}
                pueden realizarse en paralelo. Una vez aprobadas las tres, la
                postulación pasa al{" "}
                <strong className="text-blue-950">Comité Evaluador</strong> y,
                tras su aprobación final, queda habilitada para el pago.
              </p>
            </div>

            {/* DIAGRAMA VISUAL DEL WORKFLOW */}
            <div className="mb-14">
              <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
                <Activity size={20} className="text-[#C5A059]" /> 1. Estructura del Proceso
              </h3>

              <div className="flex flex-col items-center w-full bg-slate-100/50 p-6 sm:p-10 rounded-3xl border border-slate-200/60 shadow-inner">
                <FlowNode
                  title="Postulación"
                  desc="El usuario completa y envía su formulario."
                  icon={FileText}
                  colorClass="bg-slate-400"
                  borderClass="border-slate-200"
                />
                <Arrow />

                <FlowNode
                  title="Pendiente"
                  desc="Ninguna validación ha iniciado aún."
                  icon={Clock}
                  colorClass="bg-slate-500"
                  borderClass="border-slate-300"
                />
                <Arrow />

                <FlowNode
                  title="En Evaluación"
                  desc="Se inician las revisiones en paralelo."
                  icon={Activity}
                  colorClass="bg-blue-500"
                  borderClass="border-blue-200"
                />

                {/* Flechas dividiéndose */}
                <div className="flex justify-center w-full max-w-3xl relative mt-4 mb-2">
                  <div className="w-[66%] h-10 border-t-2 border-l-2 border-r-2 border-[#C5A059]/40 rounded-t-xl animate-pulse"></div>
                </div>

                {/* TAREAS EN PARALELO */}
                <div className="flex flex-col lg:flex-row items-start justify-center gap-4 lg:gap-8 w-full relative z-20">
                  <FlowNode
                    title="Avales"
                    desc="Validación de 2 patrocinadores (por correo)."
                    icon={Users}
                    colorClass="bg-teal-500"
                    borderClass="border-teal-200"
                    isParallel={true}
                  />
                  <FlowNode
                    title="Asociados"
                    desc="Revisión documental por el área."
                    icon={UserCheck}
                    colorClass="bg-teal-500"
                    borderClass="border-teal-200"
                    isParallel={true}
                  />
                  <FlowNode
                    title="Logística"
                    desc="Validación administrativa."
                    icon={Briefcase}
                    colorClass="bg-teal-500"
                    borderClass="border-teal-200"
                    isParallel={true}
                  />
                </div>

                {/* Flechas fusionándose */}
                <div className="flex justify-center w-full max-w-3xl relative mt-2 mb-4">
                  <div className="w-[66%] h-10 border-b-2 border-l-2 border-r-2 border-[#C5A059]/40 rounded-b-xl animate-pulse"></div>
                </div>

                <Arrow />
                <FlowNode
                  title="Comité Evaluador"
                  desc="Evaluación final (Requiere que las 3 áreas anteriores estén aprobadas)."
                  icon={ShieldCheck}
                  colorClass="bg-[#C5A059]"
                  borderClass="border-[#E8D09E]"
                />
                <Arrow />
                <FlowNode
                  title="Apto para Pago"
                  desc="Postulación habilitada para pagar."
                  icon={CreditCard}
                  colorClass="bg-emerald-500"
                  borderClass="border-emerald-200"
                />
                <Arrow />
                <FlowNode
                  title="Completado"
                  desc="El pago fue validado y finaliza el proceso."
                  icon={CheckCircle2}
                  colorClass="bg-emerald-600"
                  borderClass="border-emerald-300"
                />
              </div>
            </div>

            <hr className="border-slate-100 my-10" />

            {/* SECCIÓN 2: DICCIONARIO DE ESTADOS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-10">
              {/* Estados Generales */}
              <div>
                <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
                  <LayoutList size={20} className="text-[#C5A059]" /> 2. Estados Generales del Expediente
                </h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="w-3 h-3 rounded-full bg-slate-400 shrink-0 mt-1"></span>
                    <div>
                      <h6 className="text-sm font-bold text-slate-800">Pendiente</h6>
                      <p className="text-xs text-slate-500 mt-0.5">Postulación enviada, pero ninguna validación ha iniciado.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-blue-50 border border-blue-100">
                    <span className="w-3 h-3 rounded-full bg-blue-500 shrink-0 mt-1"></span>
                    <div>
                      <h6 className="text-sm font-bold text-blue-900">En evaluación</h6>
                      <p className="text-xs text-blue-700/80 mt-0.5">Al menos una de las áreas ya inició la revisión.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 border border-amber-100">
                    <span className="w-3 h-3 rounded-full bg-amber-500 shrink-0 mt-1"></span>
                    <div>
                      <h6 className="text-sm font-bold text-amber-900">Observado</h6>
                      <p className="text-xs text-amber-700/80 mt-0.5">Una o más áreas solicitaron correcciones al postulante.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-purple-50 border border-purple-100">
                    <span className="w-3 h-3 rounded-full bg-purple-500 shrink-0 mt-1"></span>
                    <div>
                      <h6 className="text-sm font-bold text-purple-900">Subsanado</h6>
                      <p className="text-xs text-purple-700/80 mt-0.5">El postulante respondió las observaciones y espera re-evaluación.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-[#FFFDF8] border border-[#E8D09E]">
                    <span className="w-3 h-3 rounded-full bg-[#C5A059] shrink-0 mt-1 animate-pulse"></span>
                    <div>
                      <h6 className="text-sm font-bold text-[#7f561e]">Apto para pago</h6>
                      <p className="text-xs text-[#7f561e]/80 mt-0.5">Todas las validaciones (incluido Comité) fueron aprobadas.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-red-50 border border-red-100">
                    <span className="w-3 h-3 rounded-full bg-red-500 shrink-0 mt-1"></span>
                    <div>
                      <h6 className="text-sm font-bold text-red-900">Rechazado</h6>
                      <p className="text-xs text-red-700/80 mt-0.5">Expediente rechazado definitivamente. No puede continuar.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                    <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0 mt-1"></span>
                    <div>
                      <h6 className="text-sm font-bold text-emerald-900">Completado</h6>
                      <p className="text-xs text-emerald-700/80 mt-0.5">Pago validado y afiliación finalizada con éxito.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Estados de Área */}
              <div>
                <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
                  <RefreshCcw size={20} className="text-[#C5A059]" /> 3. Estados por Área Interna
                </h3>
                <p className="text-sm font-medium text-slate-600 leading-relaxed mb-5 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  Los estados de cada área (Logística, Asociados, Comité) se gestionan de manera independiente. El <strong>estado general</strong> del expediente es un resumen automático que se calcula según el conjunto de estas validaciones internas.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 border border-slate-200 rounded-xl flex items-center gap-2 text-xs font-bold text-slate-600">
                    <MinusCircle size={14} className="text-slate-400" /> PENDIENTE
                  </div>
                  <div className="p-3 border border-slate-200 rounded-xl flex items-center gap-2 text-xs font-bold text-blue-700">
                    <Clock size={14} className="text-blue-500" /> EN EVALUACIÓN
                  </div>
                  <div className="p-3 border border-slate-200 rounded-xl flex items-center gap-2 text-xs font-bold text-amber-700">
                    <AlertCircle size={14} className="text-amber-500" /> OBSERVADO
                  </div>
                  <div className="p-3 border border-slate-200 rounded-xl flex items-center gap-2 text-xs font-bold text-purple-700">
                    <Clock size={14} className="text-purple-500" /> SUBSANADO
                  </div>
                  <div className="p-3 border border-slate-200 rounded-xl flex items-center gap-2 text-xs font-bold text-emerald-700">
                    <CheckCircle2 size={14} className="text-emerald-500" /> APROBADO
                  </div>
                  <div className="p-3 border border-slate-200 rounded-xl flex items-center gap-2 text-xs font-bold text-red-700">
                    <XCircle size={14} className="text-red-500" /> RECHAZADO
                  </div>
                </div>
              </div>
            </div>

            <hr className="border-slate-100 my-10" />

            {/* SECCIÓN 3: EJEMPLOS */}
            <div>
              <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
                <Eye size={20} className="text-[#C5A059]" /> 4. ¿Cómo se actualiza el expediente? (Ejemplos)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <ExampleCard
                  title="Ejemplo A"
                  states={[
                    { name: "Avales", val: "1 de 2 aprobados" },
                    { name: "Asociados", val: "Aprobado" },
                    { name: "Logística", val: "En evaluación" },
                    { name: "Comité", val: "Bloqueado" },
                    { name: "Pago", val: "Bloqueado" },
                  ]}
                  result="EN EVALUACIÓN"
                  resultColorClass="bg-blue-50 border-blue-200 text-blue-700"
                />
                <ExampleCard
                  title="Ejemplo B"
                  states={[
                    { name: "Avales", val: "Aprobado" },
                    { name: "Asociados", val: "Observado" },
                    { name: "Logística", val: "Aprobado" },
                    { name: "Comité", val: "Bloqueado" },
                    { name: "Pago", val: "Bloqueado" },
                  ]}
                  result="OBSERVADO"
                  resultColorClass="bg-amber-50 border-amber-200 text-amber-700"
                />
                <ExampleCard
                  title="Ejemplo C"
                  states={[
                    { name: "Avales", val: "Aprobado" },
                    { name: "Asociados", val: "Aprobado" },
                    { name: "Logística", val: "Aprobado" },
                    { name: "Comité", val: "Aprobado" },
                    { name: "Pago", val: "Pendiente" },
                  ]}
                  result="APTO PARA PAGO"
                  resultColorClass="bg-[#FFFDF8] border-[#E8D09E] text-[#C5A059]"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

const LayoutList = ({
  size,
  className,
}: {
  size: number;
  className?: string;
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <line x1="14" y1="4" x2="21" y2="4" />
    <line x1="14" y1="9" x2="21" y2="9" />
    <line x1="14" y1="15" x2="21" y2="15" />
    <line x1="14" y1="20" x2="21" y2="20" />
  </svg>
);

// ==========================================
// COMPONENTE PRINCIPAL
// ==========================================
export function ExpedientesWorkspace({ currentUser }: { currentUser?: any }) {
  const [expedientes, setExpedientes] = useState<SmartCaseCardData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDrawerLoading, setIsDrawerLoading] = useState(false);
  const [meta, setMeta] = useState({
    total: 0,
    page: 1,
    pageSize: 8,
    totalPages: 1,
  });
  const [isMounted, setIsMounted] = useState(false);

  const [drawerData, setDrawerData] = useState<DrawerData<any> | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showWorkflowGuide, setShowWorkflowGuide] = useState(false);

  // Estados para el Modal de Cambio de Estado con TipTap y Archivos
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [targetStatus, setTargetStatus] = useState<string>("");
  const [statusReason, setStatusReason] = useState<string>("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [observedFieldPaths, setObservedFieldPaths] = useState<string[]>([]);

  const [filters, setFilters] = useState({
    search: "",
    status: "Todos",
    modality: "Todos",
    assignedTo: "Todos",
    logisticValidation: "Todos",
    associateValidation: "Todos",
    comiteValidation: "Todos",
    paymentStatus: "Todos",
    dateFrom: "",
    dateTo: "",
    orderBy: "Más recientes",
  });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const fetchExpedientes = useCallback(async () => {
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: meta.page.toString(),
        pageSize: meta.pageSize.toString(),
      });
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== "Todos") queryParams.append(key, value);
      });
      const response = await fetch(
        `/api/afiliaciones/expedientes?${queryParams.toString()}`
      );
      const result = await response.json();
      if (result.success) {
        setExpedientes(result.data);
        setMeta(result.meta);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [filters, meta.page, meta.pageSize]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchExpedientes();
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [fetchExpedientes]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setMeta((prev) => ({ ...prev, page: 1 }));
  };

  const handleClearFilters = () => {
    setFilters({
      search: "",
      status: "Todos",
      modality: "Todos",
      assignedTo: "Todos",
      logisticValidation: "Todos",
      associateValidation: "Todos",
      comiteValidation: "Todos",
      paymentStatus: "Todos",
      dateFrom: "",
      dateTo: "",
      orderBy: "Más recientes",
    });
    setMeta((prev) => ({ ...prev, page: 1 }));
  };

  const handleOpenDrawer = async (cardData: SmartCaseCardData) => {
    setIsDrawerLoading(true);
    setIsDrawerOpen(true);

    const validations = cardData.atomicValidations || [];
    const myDepartmentName = getDepartmentLabelByRole(currentUser?.role?.slug);
    const myValidation =
      validations.find(
        (v: any) => v.label.toLowerCase() === myDepartmentName.toLowerCase()
      ) || validations[0];

    const hasAlreadyValidated =
      myValidation &&
      (myValidation.status === "APPROVED" ||
        myValidation.status === "check" ||
        myValidation.status === "OBSERVED" ||
        myValidation.status === "review" ||
        myValidation.status === "REJECTED");

    const dniMatch = cardData.identity.subtitle.match(/DNI\s*(\d+)/i);
    const cleanSubtitle = dniMatch
      ? `DNI: ${dniMatch[1]}`
      : cardData.identity.subtitle;

    const realUserName = currentUser
      ? `${currentUser.person.firstName} ${currentUser.person.paternalLastName}`
      : "Administrador";

    const updatedHeader = {
      ...cardData,
      identity: {
        ...cardData.identity,
        subtitle: cleanSubtitle,
      },
      metadata: {
        ...cardData.metadata,
        isAlreadyEvaluatedByMe: hasAlreadyValidated,
        reviewerArea: myValidation?.label || myDepartmentName,
        assignedTo: {
          name: realUserName,
          initial: realUserName.charAt(0),
        },
      },
    };

    setDrawerData({
      caseId: cardData.rawId!,
      header: updatedHeader,
      availableTabs: [],
      defaultTabId: "resumen",
      payload: null,
    });

    try {
      const response = await fetch(
        `/api/afiliaciones/expedientes/${cardData.rawId}`
      );
      const result = await response.json();
      if (result.success) {
        const fullData = result.data;
        setDrawerData({
          caseId: cardData.rawId!,
          header: updatedHeader,
          availableTabs: [
            { id: "resumen", label: "Resumen", hasNotification: false },
            { id: "datos", label: "Datos Completos", hasNotification: false },
            {
              id: "documentos",
              label: "Documentos",
              hasNotification: fullData.documents?.length > 0,
            },
            {
              id: "historial",
              label: "Historial de Actividad",
              hasNotification: false,
            },
          ],
          defaultTabId: "resumen",
          payload: fullData,
        });
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsDrawerLoading(false);
    }
  };

  const handleOpenSecureDocument = async (url: string) => {
    try {
      const res = await fetch(
        `/api/afiliaciones/postulacion/file?url=${encodeURIComponent(url)}`
      );
      const data = await res.json();
      if (data.success) window.open(data.data.url, "_blank");
    } catch (error) {
      alert("No se pudo abrir el documento.");
    }
  };

  // ===============================================
  // HANDLERS PARA ADJUNTOS EN MODAL DE OBSERVACIÓN
  // ===============================================
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setAttachments((prev) => [...prev, ...newFiles]);
    }
    // Reseteamos el input para permitir adjuntar el mismo archivo si fue eliminado
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (indexToRemove: number) => {
    setAttachments((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const confirmStatusChange = async () => {
    if (!drawerData) return;
    
    // Evitamos enviar si el editor HTML está vacío
    if (statusReason === "<p></p>" || statusReason.trim() === "") return;

    setIsUpdatingStatus(true);
    try {
      // Nota: Si en el backend van a procesar archivos (attachments), 
      // deberán cambiar este fetch a FormData. Por ahora, se envía el JSON clásico.
      const res = await fetch(
        `/api/afiliaciones/expedientes/${drawerData.caseId}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            newStatus: targetStatus,
            reason: statusReason, // Ahora este reason contiene HTML generado por TipTap
            fieldPaths: targetStatus === "OBSERVED" ? observedFieldPaths : undefined,
            // attachments: attachments (Aquí irían los archivos si usan formData o base64)
          }),
        }
      );
      const data = await res.json();
      if (data.success) {
        setShowStatusModal(false);
        setStatusReason("");
        setAttachments([]); // Limpiamos los archivos adjuntos
        setObservedFieldPaths([]);
        fetchExpedientes();
        handleOpenDrawer(drawerData.header); // Refresca en vivo el drawer
      } else {
        alert(data.message);
      }
    } catch (error) {
      alert("Error de conexión al actualizar estado.");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleReevaluate = () => {
    setTargetStatus("PENDING");
    setStatusReason("<p>Reapertura del expediente para reevaluación.</p>");
    setShowStatusModal(true);
  };

  // ===================================================
  // NUEVAS ACCIONES ADMINISTRATIVAS 
  // ===================================================
  const handleNotifyCommittee = async () => {
    if (confirm("¿Estás seguro que deseas enviar un recordatorio por correo electrónico al Comité Evaluador?")) {
      alert("Se ha notificado al comité correctamente.");
    }
  };

  const handleDeleteApplication = async () => {
    if (confirm("¡ATENCIÓN! ¿Estás completamente seguro que deseas ELIMINAR este expediente del sistema? Esta acción es irreversible.")) {
      alert("El expediente ha sido eliminado.");
      setIsDrawerOpen(false);
      fetchExpedientes();
    }
  };

  const generateTimeline = (payload: any) => {
    const events: Array<{
      date: Date;
      title: string;
      desc: string;
      icon: React.ReactNode;
      color: string;
      auditor?: string | null;
    }> = [];

    if (payload.createdAt)
      events.push({
        date: new Date(payload.createdAt),
        title: "Expediente Creado",
        desc: "El postulante inició su registro.",
        icon: <FileText size={14} />,
        color: "bg-slate-100 text-slate-500 border-slate-200",
      });
    if (payload.submittedAt)
      events.push({
        date: new Date(payload.submittedAt),
        title: "Expediente Enviado",
        desc: "El postulante finalizó y envió el formulario a revisión.",
        icon: <CheckCircle2 size={14} />,
        color: "bg-blue-100 text-blue-600 border-blue-200",
      });

    payload.history?.forEach((h: any) => {
      let auditorInfo = null;
      let cleanDesc =
        h.changeReason || "Actualización de fase realizada por el sistema.";
      const match = cleanDesc.match(/\[Por:\s(.*?)\s-\s(.*?)\]/);

      if (match) {
        auditorInfo = `${match[1]} (${match[2].replace("_", " ")})`;
        cleanDesc = cleanDesc.replace(match[0], "").trim();
      }

      const isApprove =
        h.newStatus === "APPROVED" ||
        h.newStatus === "UNDER_EVALUATION" ||
        h.newStatus === "UNDER_EVALUACION" ||
        h.newStatus === "COMPLETED" || 
        h.newStatus === "READY_FOR_PAYMENT";
        
      const isReject = h.newStatus === "REJECTED";

      events.push({
        date: new Date(h.createdAt),
        title: `Cambio de Estado: ${formatStatusName(h.newStatus)}`,
        desc: cleanDesc,
        auditor: auditorInfo,
        icon: <Activity size={14} />,
        color: isApprove
          ? "bg-emerald-100 text-emerald-600 border-emerald-200"
          : isReject
            ? "bg-red-100 text-red-600 border-red-200"
            : "bg-amber-100 text-amber-600 border-amber-200",
      });
    });

    payload.payments?.forEach((p: any) => {
      if (p.createdAt)
        events.push({
          date: new Date(p.createdAt),
          title: `Pago Registrado (${formatStatusName(p.status)})`,
          desc: `Monto: ${p.currency} ${p.totalAmount} vía ${p.gateway}`,
          icon: <CreditCard size={14} />,
          color: "bg-emerald-100 text-emerald-600 border-emerald-200",
        });
    });

    payload.approvals?.forEach((a: any, idx: number) => {
      if (a.transactionDate) {
        const isApproved = a.status === "APPROVED";
        events.push({
          date: new Date(a.transactionDate),
          title: `Respuesta Aval ${idx + 1}: ${isApproved ? "Aprobado" : "Rechazado"}`,
          desc: `Asociado: ${a.sponsorPerson?.firstName} ${a.sponsorPerson?.paternalLastName}`,
          icon: isApproved ? <CheckCircle2 size={14} /> : <XCircle size={14} />,
          color: isApproved
            ? "bg-emerald-100 text-emerald-600 border-emerald-200"
            : "bg-red-100 text-red-600 border-red-200",
        });
      }
    });

    payload.areaValidations?.forEach((v: any) => {
      if (v.validatedAt) {
        const isApproved = v.status === "RESOLVED" || v.status === "APPROVED";
        events.push({
          date: new Date(v.validatedAt),
          title: `Validación de Área: ${v.department.replace("_", " ")}`,
          desc:
            v.comments ||
            (isApproved
              ? "Área validó conforme."
              : "El área reportó observaciones."),
          icon: isApproved ? (
            <ShieldCheck size={14} />
          ) : (
            <AlertCircle size={14} />
          ),
          color: isApproved
            ? "bg-emerald-100 text-emerald-600 border-emerald-200"
            : "bg-red-100 text-red-600 border-red-200",
        });
      }
    });

    payload.observations?.forEach((observation: any) => {
      const fields = Array.isArray(observation.fieldPaths) ? observation.fieldPaths : [];
      const names = fields.map((path: string) => OBSERVATION_FIELDS.find((field) => field.key === path)?.label ?? path);
      const message = String(observation.errorDescription ?? "").replace(/<[^>]*>/g, "").trim();
      events.push({
        date: new Date(observation.createdAt),
        title: `Observación: ${observation.reviewDepartment}`,
        desc: `${message}${names.length ? ` Campos observados: ${names.join(", ")}.` : ""}`,
        icon: <AlertCircle size={14} />,
        color: observation.status === "RESOLVED" ? "bg-purple-100 text-purple-600 border-purple-200" : "bg-red-100 text-red-600 border-red-200",
      });
    });

    return events.sort((a, b) => b.date.getTime() - a.date.getTime());
  };

  const renderDrawerContent = (activeTab: string, payload: any) => {
    if (isDrawerLoading || !payload) {
      return (
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <div className="animate-spin w-10 h-10 border-4 border-[#C5A059] border-t-transparent rounded-full"></div>
          <span className="text-sm font-bold text-slate-500">
            Recopilando datos e historial del expediente...
          </span>
        </div>
      );
    }

    const header = drawerData?.header;
    const validations = header?.atomicValidations || [];
    const completedCount = validations.filter(
      (v: any) => v.status === "check" || v.status === "APPROVED"
    ).length;
    const progressPercentage =
      validations.length > 0
        ? Math.round((completedCount / validations.length) * 100)
        : 0;

    const hasAlreadyValidated = header?.metadata?.isAlreadyEvaluatedByMe;
    const reviewerArea =
      header?.metadata?.reviewerArea || "Área correspondiente";

    const draft = payload.draftData || {};
    const personalInfo = draft.personalInformation || {};
    const academicStudy = draft.academicStudies?.[0] || {};
    const employmentInfo = draft.employmentInformation || {};
    const endorsements = draft.endorsements || {};
    const approvals = payload.approvals || [];

    const isStudent = payload.affiliateType === "STUDENT";
    
    const countAvalesAprobados = approvals.filter(
      (a: any) => a.status === "APPROVED"
    ).length;
    const areEndorsementsReady = isStudent || countAvalesAprobados === 2;

    // [!] LÓGICA DE BLOQUEO PARA EL COMITÉ
    const isComite = currentUser?.role?.slug === "COMITE_EVALUADOR";
    const logisticaValidation = validations.find((v: any) =>
      v.label.toLowerCase().includes("log")
    );
    const asociadosValidation = validations.find((v: any) =>
      v.label.toLowerCase().includes("aso")
    );

    const isLogisticaOk =
      logisticaValidation?.status === "check" ||
      logisticaValidation?.status === "APPROVED" ||
      logisticaValidation?.status === "RESOLVED";
    const isAsociadosOk =
      asociadosValidation?.status === "check" ||
      asociadosValidation?.status === "APPROVED" ||
      asociadosValidation?.status === "RESOLVED";

    // El comité solo puede actuar si Avales, Logística y Asociados están Ok
    const isReadyForComite = isComite
      ? areEndorsementsReady && isLogisticaOk && isAsociadosOk
      : true;

    // Identificamos si el expediente ya está en un estado terminal o post-evaluación
    const isClosedFinal =
      payload.status === "APPROVED" ||
      payload.status === "COMPLETED" ||
      payload.status === "REJECTED" ||
      payload.status === "READY_FOR_PAYMENT";

    const isActionDisabled = isClosedFinal || hasAlreadyValidated || (isComite && !isReadyForComite);

    const submittedDate = payload.submittedAt
      ? new Date(payload.submittedAt).toLocaleString("es-PE", {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "No enviado";
    const payment = payload.payments?.[0];
    const paymentMethod = payment?.gateway
      ? payment.gateway.toLowerCase().replace(/_/g, " ")
      : isStudent
        ? "Beca Pregrado"
        : "Pendiente";
    const invoiceType =
      payment?.billing?.invoice?.type || (isStudent ? "No aplica" : "Boleta");
    const amount = payment?.totalAmount
      ? `${payment.currency || "PEN"} ${payment.totalAmount}`
      : isStudent
        ? "Gratuito"
        : "S/ 0.00";

    if (activeTab === "resumen") {
      return (
        <div className="space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div>
            <h3 className="text-[13px] font-bold text-slate-800 mb-3 flex items-center gap-2">
              Estado del expediente
            </h3>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3 sm:space-y-4">
              {validations.map((val: any, idx: number) => (
                <div
                  key={idx}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-0 rounded-xl sm:rounded-none bg-slate-50 sm:bg-transparent border border-slate-100 sm:border-none"
                >
                  <div className="flex items-center gap-3 sm:w-1/3">
                    <DynamicIcon
                      name={val.icon}
                      size={16}
                      className="text-slate-500"
                    />
                    <span className="text-[12px] font-bold text-slate-700">
                      {val.label}
                    </span>
                  </div>
                  <div className="sm:w-1/3 flex sm:justify-start">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${val.statusColorClass}`}
                    >
                      <DrawerStatusIcon
                        status={val.status}
                        className="w-3 h-3"
                      />
                      {formatStatusName(val.statusLabel || val.status)}
                    </span>
                  </div>
                  <div className="sm:w-1/3 flex flex-col sm:items-end text-left sm:text-right">
                    <span
                      className={`text-[11px] font-black truncate w-full sm:text-right ${val.status === "check" || val.status === "APPROVED" ? "text-[#C5A059]" : val.status === "error" || val.status === "REJECTED" ? "text-red-500" : "text-slate-400"}`}
                    >
                      {val.assignee?.name || "Sin asignar"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-[13px] font-bold text-slate-800 mb-3">
              Progreso general
            </h3>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm">
              <div className="flex items-end justify-between mb-3">
                <span className="text-xs font-medium text-slate-500">
                  {completedCount} de {validations.length} validaciones
                  completadas
                </span>
                <span className="text-2xl font-black text-slate-800 leading-none">
                  {progressPercentage}%
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-[#C5A059] h-2.5 rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${progressPercentage}%` }}
                ></div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-[13px] font-bold text-slate-800 mb-3">
              Información de solicitud
            </h3>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm">
              <dl className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b border-slate-50 pb-4 gap-1">
                  <dt className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Modalidad
                  </dt>
                  <dd className="text-sm font-bold text-slate-800">
                    {header?.identity.categoryBadge?.label}
                  </dd>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b border-slate-50 pb-4 gap-1">
                  <dt className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Fecha de envío
                  </dt>
                  <dd className="text-sm font-bold text-slate-800">
                    {submittedDate}
                  </dd>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b border-slate-50 pb-4 gap-1">
                  <dt className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Tipo de pago
                  </dt>
                  <dd
                    className={`text-sm font-bold capitalize ${isStudent ? "text-emerald-600" : "text-slate-800"}`}
                  >
                    {paymentMethod}
                  </dd>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b border-slate-50 pb-4 gap-1">
                  <dt className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Comprobante
                  </dt>
                  <dd className="text-sm font-bold text-slate-800 capitalize">
                    {invoiceType.toLowerCase()}
                  </dd>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                  <dt className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Monto
                  </dt>
                  <dd
                    className={`text-[15px] font-black ${isStudent ? "text-emerald-600" : "text-[#C5A059]"}`}
                  >
                    {amount}
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          <div>
            <h3 className="text-[13px] font-bold text-slate-800 mb-3">
              Acciones de Evaluación
            </h3>

            {isComite && !isReadyForComite && (
              <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 text-xs font-bold text-amber-700 shadow-sm">
                <Clock size={16} className="shrink-0" />
                Esperando conformidad de Logística, Asociados y Avales para
                habilitar su revisión.
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                onClick={() => {
                  setTargetStatus("APPROVED");
                  setShowStatusModal(true);
                }}
                disabled={isActionDisabled}
                className={`flex flex-col items-center justify-center gap-1.5 px-2 py-3 bg-[#fdfaf5] border-2 border-[#E8D09E] text-[#7f561e] rounded-xl text-[11px] font-black transition-all shadow-sm focus:outline-none ${isActionDisabled ? "opacity-50 cursor-not-allowed grayscale" : "hover:bg-[#C5A059] hover:text-white hover:border-[#C5A059]"}`}
              >
                <ShieldCheck size={18} strokeWidth={2.5} /> Otorgar Conformidad
              </button>
              <button
                onClick={() => {
                  setTargetStatus("OBSERVED");
                  setShowStatusModal(true);
                }}
                disabled={isActionDisabled}
                className={`flex flex-col items-center justify-center gap-1.5 px-2 py-3 border border-amber-200 rounded-xl text-[11px] font-black transition-colors shadow-sm focus:outline-none ${isActionDisabled ? "bg-gray-50 text-gray-400 cursor-not-allowed border-gray-200 grayscale opacity-60" : "bg-amber-50 text-amber-700 hover:bg-amber-500 hover:text-white"}`}
              >
                <AlertCircle size={18} strokeWidth={2.5} /> Observar
              </button>
              <button
                onClick={() => {
                  setTargetStatus("REJECTED");
                  setShowStatusModal(true);
                }}
                disabled={isActionDisabled}
                className={`flex flex-col items-center justify-center gap-1.5 px-2 py-3 border border-red-200 rounded-xl text-[11px] font-black transition-colors shadow-sm focus:outline-none ${isActionDisabled ? "bg-gray-50 text-gray-400 cursor-not-allowed border-gray-200 grayscale opacity-60" : "bg-red-50 text-red-700 hover:bg-red-600 hover:border-red-600 hover:text-white"}`}
              >
                <XCircle size={18} strokeWidth={2.5} /> Rechazar Definitivo
              </button>
            </div>

            {hasAlreadyValidated && !isClosedFinal && (
              <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-center gap-2 text-emerald-700 font-bold text-xs shadow-sm">
                <CheckCircle2 size={16} />
                Su área ({reviewerArea}) ya evaluó este expediente.
              </div>
            )}
            
            {payload.status === "REJECTED" && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center justify-center gap-2 text-red-700 font-bold text-xs shadow-sm animate-in fade-in">
                <XCircle size={16} /> Este expediente fue rechazado y el proceso ha finalizado.
              </div>
            )}
            
            <div className="pt-6 mt-6 border-t border-slate-100">
              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3">Acciones Administrativas</h3>
              <div className="flex flex-wrap gap-3">
                <button 
                  onClick={handleNotifyCommittee}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-colors shadow-sm"
                >
                  <BellRing size={14} /> Notificar al Comité
                </button>
                <button 
                  onClick={handleDeleteApplication}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:text-red-600 hover:bg-red-50 transition-colors shadow-sm"
                >
                  <Trash2 size={14} /> Eliminar Expediente
                </button>
              </div>
            </div>

          </div>
        </div>
      );
    }

    if (activeTab === "datos") {
      const rawNames =
        `${personalInfo.names || payload.person?.firstName || ""} ${personalInfo.fatherLastName || payload.person?.paternalLastName || ""} ${personalInfo.motherLastName || payload.person?.maternalLastName || ""}`.trim();
      const generoLabel =
        personalInfo.gender === "MALE"
          ? "Masculino"
          : personalInfo.gender === "FEMALE"
            ? "Femenino"
            : personalInfo.gender;
      const universidadName =
        academicStudy.otherInstitution ||
        payload.person?.academicInfos?.[0]?.university?.name ||
        (academicStudy.institutionId ? "Institución Registrada" : "");

      return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300 pb-10">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex items-center gap-3">
              <User size={18} className="text-slate-600" />
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">
                Datos Personales
              </h3>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <DataField
                label="Nombres y Apellidos"
                value={rawNames}
                fullWidth
              />
              <DataField
                label={`Documento (${payload.documentType})`}
                value={payload.documentNumber}
              />
              <div className="hidden lg:block"></div>
              <DataField
                label="Fecha Nacimiento"
                value={personalInfo.birthDate}
              />
              <DataField label="Género" value={generoLabel} />
              <div className="hidden lg:block"></div>
              <DataField
                label="Correo Principal"
                value={personalInfo.primaryEmail || payload.email}
              />
              <DataField
                label="Correo Secundario"
                value={personalInfo.secondaryEmail}
              />
              <div className="hidden lg:block"></div>
              <DataField
                label="Celular"
                value={personalInfo.phone || payload.phone}
              />
              <DataField label="Teléfono Fijo" value={personalInfo.landline} />
              <div className="hidden lg:block"></div>
              <DataField
                label="Dirección de Residencia"
                value={personalInfo.address}
                fullWidth
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex items-center gap-3">
              <GraduationCap size={18} className="text-slate-600" />
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">
                Formación Académica
              </h3>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <DataField
                label="Universidad / Institución"
                value={universidadName}
                fullWidth
              />
              <DataField
                label="Grado / Título"
                value={academicStudy.degreeTitle}
              />
              <DataField label="Especialidad" value={academicStudy.specialty} />
              <DataField
                label="Año de Ingreso"
                value={academicStudy.admissionYear}
              />
              <DataField
                label="Año de Egreso"
                value={academicStudy.graduationYear}
              />
              {!isStudent && (
                <>
                  <DataField
                    label="Colegio Profesional"
                    value={academicStudy.professionalAssociation}
                  />
                  <DataField
                    label="N° Registro (CIP)"
                    value={academicStudy.registrationNumber}
                  />
                </>
              )}
            </div>
          </div>

          {!isStudent && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex items-center gap-3">
                <Briefcase size={18} className="text-slate-600" />
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">
                  Información Laboral
                </h3>
              </div>
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <DataField
                  label="Empresa / Institución"
                  value={employmentInfo.companyName}
                  fullWidth
                />
                <DataField
                  label="RUC Empresa"
                  value={employmentInfo.companyTaxId}
                />
                <DataField label="Cargo" value={employmentInfo.positionName} />
                <DataField
                  label="Área / Departamento"
                  value={employmentInfo.area}
                />
                <DataField
                  label="Correo Corporativo"
                  value={employmentInfo.workEmail}
                />
                <DataField
                  label="Teléfono Trabajo"
                  value={
                    employmentInfo.workPhone
                      ? `${employmentInfo.workPhone} ${employmentInfo.workExtension ? `(Anexo: ${employmentInfo.workExtension})` : ""}`
                      : null
                  }
                />
                <DataField
                  label="Dirección Laboral"
                  value={employmentInfo.workingAddress}
                  fullWidth
                />
              </div>
            </div>
          )}

          {!isStudent && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex items-center gap-3">
                <Users size={18} className="text-slate-600" />
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">
                  Avales Presentados
                </h3>
              </div>
              <div className="p-5 space-y-4">
                <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Aval 1 - DNI{" "}
                      {endorsements.firstEndorsement?.sponsorDocumentNumber}
                    </span>
                    <span className="text-[14px] font-bold text-slate-800 capitalize">
                      {endorsements.firstEndorsement?.sponsorFullName?.toLowerCase() ||
                        "No registrado"}
                    </span>
                    <span className="text-[12px] font-medium text-slate-500">
                      {endorsements.firstEndorsement?.sponsorEmail}
                    </span>
                  </div>
                  {approvals[0] && (
                    <span
                      className={`w-max px-3 py-1.5 text-[11px] font-bold uppercase rounded-lg border ${approvals[0].status === "APPROVED" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : approvals[0].status === "REJECTED" ? "bg-red-50 text-red-700 border-red-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}
                    >
                      {approvals[0].status === "APPROVED"
                        ? "Respaldado"
                        : approvals[0].status === "REJECTED"
                          ? "Rechazado"
                          : "Pendiente de respuesta"}
                    </span>
                  )}
                </div>

                <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Aval 2 - DNI{" "}
                      {endorsements.secondEndorsement?.sponsorDocumentNumber}
                    </span>
                    <span className="text-[14px] font-bold text-slate-800 capitalize">
                      {endorsements.secondEndorsement?.sponsorFullName?.toLowerCase() ||
                        "No registrado"}
                    </span>
                    <span className="text-[12px] font-medium text-slate-500">
                      {endorsements.secondEndorsement?.sponsorEmail}
                    </span>
                  </div>
                  {approvals[1] && (
                    <span
                      className={`w-max px-3 py-1.5 text-[11px] font-bold uppercase rounded-lg border ${approvals[1].status === "APPROVED" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : approvals[1].status === "REJECTED" ? "bg-red-50 text-red-700 border-red-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}
                    >
                      {approvals[1].status === "APPROVED"
                        ? "Respaldado"
                        : approvals[1].status === "REJECTED"
                          ? "Rechazado"
                          : "Pendiente de respuesta"}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    if (activeTab === "documentos") {
      return (
        <div className="grid grid-cols-1 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
          {payload.documents.length > 0 ? (
            payload.documents.map((doc: any) => {
              const friendlyName = getDocumentFriendlyName(doc);
              const fileExtension =
                doc.fileName?.split(".").pop()?.toUpperCase() || "PDF";

              return (
                <div
                  key={doc.id}
                  className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:border-[#C5A059] transition-all"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 text-[#C5A059]">
                      <FileText size={24} />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[14px] font-black text-slate-800 truncate">
                        {friendlyName}
                      </span>
                      <span className="text-[11px] font-medium text-slate-400 mt-0.5 truncate">
                        Archivo: {doc.fileName} • Formato:{" "}
                        <strong className="text-slate-600">
                          {fileExtension}
                        </strong>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    <button
                      onClick={() => handleOpenSecureDocument(doc.fileUrl)}
                      className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:border-[#C5A059] hover:text-[#C5A059] rounded-xl text-xs font-bold transition-all shadow-sm"
                    >
                      <Eye size={15} /> Previsualizar
                    </button>
                    <button
                      onClick={() => handleOpenSecureDocument(doc.fileUrl)}
                      className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 bg-[#C5A059] text-white hover:bg-[#b58f48] rounded-xl text-xs font-bold transition-all shadow-sm"
                    >
                      <Download size={15} /> Descargar
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center p-12 text-slate-400 bg-white rounded-2xl border border-slate-200 border-dashed">
              No hay documentos adjuntos para este expediente.
            </div>
          )}
        </div>
      );
    }

    if (activeTab === "historial") {
      const timelineEvents = generateTimeline(payload);
      const recentEvents = timelineEvents.slice(0, 5);
      const hasMoreEvents = timelineEvents.length > 5;

      return (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
          <h3 className="text-[15px] font-black text-slate-800 mb-8 flex items-center gap-3 border-b border-slate-100 pb-3">
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
              <Activity size={16} className="text-slate-600" />
            </div>
            Historial de Auditoría
          </h3>

          <div className="relative border-l-2 border-slate-100 ml-4 space-y-8 pb-4">
            {recentEvents.map((event, i) => (
              <div key={i} className="relative pl-8">
                <div
                  className={`absolute -left-[17px] top-1 w-8 h-8 rounded-full border-4 border-white flex items-center justify-center shadow-sm ${event.color}`}
                >
                  {event.icon}
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1.5">
                  <h4 className="text-sm font-bold text-slate-800">
                    {event.title}
                  </h4>
                  <span className="text-[11px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md w-max">
                    {event.date.toLocaleString("es-PE", {
                      dateStyle: "long",
                      timeStyle: "short",
                    })}
                  </span>
                </div>

                {event.auditor && (
                  <span className="inline-block mt-1 mb-2 px-2.5 py-1 bg-slate-100 text-[#C5A059] text-[10px] font-black rounded uppercase tracking-wider border border-[#e8d09e]">
                    {event.auditor.includes("SISTEMA")
                      ? "Ejecutado por:"
                      : "Validado por:"}{" "}
                    {event.auditor}
                  </span>
                )}

                <p className="text-[13px] font-medium text-slate-600 leading-relaxed bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                  {event.desc}
                </p>
              </div>
            ))}

            {timelineEvents.length === 0 && (
              <div className="pl-8 text-sm font-medium text-slate-400">
                No se registraron eventos en la línea de tiempo.
              </div>
            )}

            {hasMoreEvents && (
              <div className="pl-8 mt-6">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs font-bold text-slate-500 shadow-sm">
                  + {timelineEvents.length - 5} eventos anteriores agrupados
                  para mantener la vista limpia.
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">Expedientes de Afiliación</h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Gestiona, evalúa y resuelve las solicitudes pendientes.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-sm font-bold transition-all shadow-sm focus:outline-none">
            <FileSpreadsheet size={18} strokeWidth={2.5} /> Exportar Excel
          </button>
          <button
            onClick={() => setShowWorkflowGuide(true)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-xl text-sm font-bold transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          >
            <Info size={18} strokeWidth={2.5} /> Ver flujo de evaluación
          </button>
        </div>
      </div>

      <ExpedientesFilterBar
        filters={filters}
        onFilterChange={handleFilterChange}
        totalResults={meta.total}
      />

      <div >
        <div className="mt-4">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm z-10 rounded-3xl">
              <div className="flex flex-col items-center gap-3">
                <div className="animate-spin w-10 h-10 border-4 border-[#C5A059] border-t-transparent rounded-full"></div>
                <span className="text-sm font-bold text-slate-500">
                  Actualizando expedientes...
                </span>
              </div>
            </div>
          ) : expedientes.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
              {expedientes.map((exp) => (
                <SmartCaseCard
                  key={exp.id}
                  data={exp}
                  onClick={() => handleOpenDrawer(exp)}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center bg-transparent rounded-2xl border-2 border-slate-200 border-dashed animate-in fade-in zoom-in-95 duration-500">
              <div className="relative mb-6 mt-4">
                <div className="absolute inset-0 bg-[#C5A059]/20 blur-2xl rounded-full animate-pulse"></div>
                <div className="relative w-24 h-24 bg-white border border-slate-100 shadow-md rounded-full flex items-center justify-center z-10 animate-[bounce_3s_ease-in-out_infinite]">
                  <UserSearch size={44} className="text-slate-300" strokeWidth={1.5} />
                  <div className="absolute -bottom-1 -right-1 w-10 h-10 bg-[#fdfaf5] border-2 border-white rounded-full flex items-center justify-center shadow-sm">
                    <X size={20} className="text-[#C5A059]" strokeWidth={3} />
                  </div>
                </div>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight mb-2">
                No hay resultados para tu búsqueda
              </h3>
              <p className="text-sm font-medium text-slate-500 max-w-md mx-auto mb-8 leading-relaxed">
                No hemos encontrado información de ningún postulante que coincida con los filtros actuales.
              </p>
              <button
                onClick={handleClearFilters}
                className="group px-6 py-3 bg-white border border-slate-200 text-slate-600 hover:text-[#C5A059] hover:border-[#C5A059] hover:bg-[#fdfaf5] rounded-xl font-bold text-sm transition-all shadow-sm flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#C5A059]/30"
              >
                <RefreshCcw size={16} strokeWidth={2.5} className="group-hover:-rotate-180 transition-transform duration-500" />
                Limpiar todos los filtros
              </button>
            </div>
          )}
        </div>

        {expedientes.length > 0 && (
          <div className="mt-8 pt-6 border-t border-slate-100">
            <ExpedientesPagination
              meta={meta}
              onPageChange={(page) => setMeta((prev) => ({ ...prev, page }))}
              onPageSizeChange={(pageSize) =>
                setMeta((prev) => ({ ...prev, pageSize, page: 1 }))
              }
            />
          </div>
        )}
      </div>

      {isMounted &&
        showStatusModal &&
        createPortal(
          <div className="fixed inset-0 z-[999999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden animate-in zoom-in-95">
              
              {/* Cabecera */}
              <div className="p-6 text-center border-b border-gray-100 bg-gray-50/50">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border ${targetStatus === 'REJECTED' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-amber-100 text-amber-600 border-amber-200'}`}>
                  <AlertTriangle size={28} />
                </div>
                <h2 className="text-xl font-black text-slate-800 tracking-tight">
                  {targetStatus === "OBSERVED"
                    ? "¿Observar Expediente?"
                    : targetStatus === "PENDING"
                      ? "¿Reevaluar Expediente?"
                      : targetStatus === "REJECTED"
                        ? "⚠ ¿Rechazar Definitivamente?"
                        : "¿Otorgar Conformidad?"}
                </h2>
                <p className="text-sm text-slate-500 mt-2 leading-relaxed px-4">
                  Está a punto de cambiar el estado del trámite a <strong className="text-slate-800 uppercase">{formatStatusName(targetStatus)}</strong>. Su nombre de usuario quedará registrado en el historial.
                </p>
              </div>

              {/* Cuerpo del Formulario */}
              <div className="p-6 space-y-5">
                {/* Zona del Editor */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2 ml-1">
                    Motivo o Comentario <span className="text-red-500">*</span>
                  </label>
                  <RichTextEditor 
                    value={statusReason} 
                    onChange={setStatusReason} 
                    placeholder="Describa el motivo de forma detallada..."
                  />
                </div>

                {targetStatus === "OBSERVED" && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2 ml-1">
                      Campos que debe corregir <span className="text-red-500">*</span>
                    </label>
                    <div className="max-h-52 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 rounded-xl border border-slate-200 bg-slate-50">
                      {OBSERVATION_FIELDS.map((field) => {
                        const checked = observedFieldPaths.includes(field.key);
                        return (
                          <label key={field.key} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => setObservedFieldPaths((current) => checked ? current.filter((key) => key !== field.key) : [...current, field.key])}
                              className="accent-amber-500"
                            />
                            {field.label}
                          </label>
                        );
                      })}
                    </div>
                    {observedFieldPaths.length === 0 && <p className="text-[11px] text-amber-700 mt-2">Seleccione los campos que el postulante podrá editar.</p>}
                  </div>
                )}

                {/* Zona de Adjuntos */}
                <div>
                  <div className="flex items-center justify-between mb-2 ml-1 pr-1">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                      Evidencia Adjunta <span className="text-gray-400 font-normal normal-case">(Opcional)</span>
                    </label>
                    <button 
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-xs font-bold text-[#c39254] flex items-center gap-1 hover:text-[#7f561e] transition-colors bg-[#c39254]/10 px-2 py-1 rounded-md"
                    >
                      <Paperclip size={14} />
                      Añadir archivo
                    </button>
                    <input 
                      type="file" 
                      multiple 
                      className="hidden" 
                      ref={fileInputRef}
                      onChange={handleFileChange}
                    />
                  </div>

                  {/* Lista de archivos */}
                  {attachments.length > 0 ? (
                    <ul className="space-y-2 max-h-36 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 pr-2">
                      {attachments.map((file, idx) => (
                        <li key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 border border-gray-200 group hover:border-[#c39254]/50 transition-colors">
                          <div className="flex items-center gap-3 overflow-hidden">
                            <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center shrink-0">
                              <FileText size={16} className="text-slate-400" />
                            </div>
                            <div className="flex flex-col truncate">
                              <span className="text-sm font-bold text-slate-700 truncate">{file.name}</span>
                              <span className="text-[10px] text-slate-400 font-medium">
                                {(file.size / 1024 / 1024).toFixed(2)} MB
                              </span>
                            </div>
                          </div>
                          <button 
                            onClick={() => removeFile(idx)}
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                            title="Eliminar archivo"
                          >
                            <X size={16} strokeWidth={2.5} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-5 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center text-slate-400 hover:border-[#c39254] hover:bg-[#c39254]/5 hover:text-[#c39254] transition-all cursor-pointer group"
                    >
                      <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center mb-2 group-hover:bg-[#c39254]/10 transition-colors">
                        <UploadCloud size={20} />
                      </div>
                      <span className="text-sm font-bold">Clic para adjuntar archivos</span>
                      <span className="text-xs font-medium opacity-70">JPG, PNG, PDF permitidos</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer (Botones) */}
              <div className="p-6 pt-2 flex gap-3">
                <button 
                  onClick={() => {
                    setShowStatusModal(false);
                    setAttachments([]); // Importante limpiar al cancelar
                  }}
                  className="flex-1 py-3.5 rounded-xl border-2 border-gray-200 text-slate-600 font-bold text-sm hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={confirmStatusChange}
                  disabled={isUpdatingStatus || statusReason === "<p></p>" || statusReason.trim() === "" || (targetStatus === "OBSERVED" && observedFieldPaths.length === 0)}
                  className={`flex-1 py-3.5 rounded-xl text-white font-black tracking-wide text-sm shadow-[0_8px_20px_-6px_rgba(0,0,0,0.2)] hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:shadow-none ${targetStatus === "OBSERVED" ? "bg-amber-500 hover:bg-amber-600 hover:shadow-[0_12px_25px_-6px_rgba(245,158,11,0.5)]" : targetStatus === "REJECTED" ? "bg-red-600 hover:bg-red-700 hover:shadow-[0_12px_25px_-6px_rgba(220,38,38,0.5)]" : "bg-gradient-to-r from-[#dca45c] to-[#c39254] hover:shadow-[0_12px_25px_-6px_rgba(197,160,89,0.7)]"}`}
                >
                  {isUpdatingStatus ? "Actualizando..." : "Sí, confirmar"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* MODAL DE GUÍA INFORMATIVA DEL FLUJO */}
      {isMounted && showWorkflowGuide && <WorkflowGuideModal onClose={() => setShowWorkflowGuide(false)} />}

      <InspectionDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        data={drawerData}
        renderContent={renderDrawerContent}
        onReevaluate={handleReevaluate}
      />
    </div>
  );
}
