"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { SmartCaseCard } from "@/modules/shared/Components/SmartCaseCard/SmartCaseCard";
import { ExpedientesFilterBar } from "../Components/ExpedientesFilterBar";
import { ExpedientesPagination } from "../Components/ExpedientesPagination";
import { InspectionDrawer } from "@/modules/shared/Components/InspectionDrawer/InspectionDrawer";
import { RichTextEditor } from "@/modules/shared/Components/RichTextEditor/RichTextEditor";
import type { SmartCaseCardData } from "@/modules/shared/Components/SmartCaseCard/types";
import type { DrawerData } from "@/modules/shared/Components/InspectionDrawer/types";
import {
  RefreshCcw,
  Info,
  AlertCircle,
  XCircle,
  CheckCircle2,
  Download,
  UploadCloud,
  Paperclip,
  AlertTriangle,
  User,
  GraduationCap,
  Briefcase,
  FileText,
  Users,
  X,
  CreditCard,
  Activity,
  ShieldCheck,
  UserCheck,
  CalendarClock,
  Clock,
  MinusCircle
} from "lucide-react";

import { getDepartmentLabelByRole } from "../Utils/expedientes.utils";
import { ResumenTab } from "../Components/Drawer/Tabs/ResumenTab";
import { DatosTab } from "../Components/Drawer/Tabs/DatosTab";
import { DocumentosTab } from "../Components/Drawer/Tabs/DocumentosTab";
import { ObservacionesTab } from "../Components/Drawer/Tabs/ObservacionesTab";
import { AvalesTab } from "../Components/Drawer/Tabs/AvalesTab";
import { WorkflowGuideModal } from "../Components/WorkflowGuideModal";

import {
  OBSERVATION_FIELDS,
  OBSERVATION_CATEGORIES,
  applyGeographicDependencies,
} from "@/modules/afiliaciones/observations/ObservationFields";
import { DynamicIcon } from "@/modules/layout/Utils/DynamicIcon";

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

const DrawerStatusIcon = ({ status, className = "" }: { status: string; className?: string }) => {
  if (status === "check" || status === "APPROVED") return <CheckCircle2 size={14} className={className} strokeWidth={2.5} />;
  if (status === "pending" || status === "clock" || status === "UNDER_EVALUATION" || status === "UNDER_EVALUACION" || status === "RESOLVED") return <Clock size={14} className={className} strokeWidth={2.5} />;
  if (status === "error" || status === "REJECTED") return <XCircle size={14} className={className} strokeWidth={2.5} />;
  if (status === "dash" || status === "PENDING") return <MinusCircle size={14} className={className} strokeWidth={2.5} />;
  if (status === "review" || status === "OBSERVED") return <AlertCircle size={14} className={className} strokeWidth={2.5} />;
  return null;
};

const DataField = ({ label, value, fullWidth = false }: { label: string; value: any; fullWidth?: boolean }) => (
  <div className={`flex flex-col gap-1 ${fullWidth ? "sm:col-span-2 lg:col-span-3" : ""}`}>
    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</span>
    <span className="text-[13px] font-semibold text-slate-800">
      {value || <span className="text-slate-300 italic font-medium">No registrado</span>}
    </span>
  </div>
);

const getDocumentFriendlyName = (document: { category: string; fileName?: string; mimeType?: string }) => {
  if (document.category === "OTHER" && (document.mimeType?.startsWith("image/") || /foto|photograph/i.test(document.fileName ?? ""))) {
    return "Fotografía del postulante";
  }
  switch (document.category) {
    case "ID_DOCUMENT": return "Documento de Identidad (DNI / CE / Pasaporte)";
    case "SWORN_DECLARATION": return "Declaración Jurada Firmada";
    case "CV": return "Currículum Vitae (CV)";
    case "RECOMMENDATION_LETTER": return "Carta de Recomendación";
    case "DEGREE_CERTIFICATE": return "Certificado Académico";
    case "PAYMENT_VOUCHER": return "Voucher o Comprobante de Pago";
    default: return "Constancia de Estudios / Documento Adicional";
  }
};

export function ExpedientesWorkspace({ currentUser }: { currentUser?: any }) {
  const [expedientes, setExpedientes] = useState<SmartCaseCardData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDrawerLoading, setIsDrawerLoading] = useState(false);
  const [meta, setMeta] = useState({ total: 0, page: 1, pageSize: 8, totalPages: 1 });
  const [isMounted, setIsMounted] = useState(false);

  // Inicializamos en false para que nazca pegado al fondo
  const [isPaginationSticky, setIsPaginationSticky] = useState(false);

  const [drawerData, setDrawerData] = useState<DrawerData<any> | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showWorkflowGuide, setShowWorkflowGuide] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [targetStatus, setTargetStatus] = useState<string>("");

  // --- ESTADOS PARA OBSERVAR ---
  const [statusReason, setStatusReason] = useState<string>("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [observedFieldPaths, setObservedFieldPaths] = useState<string[]>([]);
  const [activeObservationCategory, setActiveObservationCategory] = useState<string>("personal");

  const [toastMessage, setToastMessage] = useState<{ title: string; type: "success" | "error" } | null>(null);

  const [filters, setFilters] = useState({
    search: "", status: "Todos", modality: "Todos", assignedTo: "Todos",
    logisticValidation: "Todos", associateValidation: "Todos", comiteValidation: "Todos",
    legalValidation: "Todos", comunicacionesValidation: "Todos", paymentStatus: "Todos",
    dateFrom: "", dateTo: "", orderBy: "Más recientes",
  });

  useEffect(() => { setIsMounted(true); }, []);

  const showToast = (title: string, type: "success" | "error" = "success") => {
    setToastMessage({ title, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchExpedientes = useCallback(async () => {
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams({ page: meta.page.toString(), pageSize: meta.pageSize.toString() });
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== "Todos") queryParams.append(key, value);
      });
      const response = await fetch(`/api/afiliaciones/expedientes?${queryParams.toString()}`);
      const result = await response.json();
      if (result.success) {
        setExpedientes(result.data);
        setMeta(result.meta);
        return result.data;
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
    return [];
  }, [filters, meta.page, meta.pageSize]);

  useEffect(() => {
    const timeoutId = setTimeout(() => fetchExpedientes(), 500);
    return () => clearTimeout(timeoutId);
  }, [fetchExpedientes]);

  const handleFilterChange = (key: string, value?: string) => {
    setFilters((prev) => ({ ...prev, [key]: value || "" }));
    setMeta((prev) => ({ ...prev, page: 1 }));
  };

  const handleClearFilters = () => {
    setFilters({
      search: "", status: "Todos", modality: "Todos", assignedTo: "Todos",
      logisticValidation: "Todos", associateValidation: "Todos", comiteValidation: "Todos",
      legalValidation: "Todos", comunicacionesValidation: "Todos", paymentStatus: "Todos",
      dateFrom: "", dateTo: "", orderBy: "Más recientes",
    });
    setMeta((prev) => ({ ...prev, page: 1 }));
  };

  const handleOpenDrawer = async (cardData: SmartCaseCardData, forceTab?: string) => {
    setIsDrawerLoading(true);
    setIsDrawerOpen(true);

    const validations = cardData.atomicValidations || [];
    const myDepartmentName = getDepartmentLabelByRole(currentUser?.role?.slug);
    const myValidation = validations.find((v: any) => v.label.toLowerCase() === myDepartmentName.toLowerCase()) || validations[0];

    const hasAlreadyValidated = myValidation && ["APPROVED", "check", "REJECTED", "error"].includes(myValidation.status);

    const dniMatch = cardData.identity.subtitle.match(/DNI\s*(\d+)/i);
    const cleanSubtitle = dniMatch ? `DNI: ${dniMatch[1]}` : cardData.identity.subtitle;
    const realUserName = currentUser ? `${currentUser.person.firstName} ${currentUser.person.paternalLastName}` : "Administrador";

    const updatedHeader = {
      ...cardData,
      identity: { ...cardData.identity, subtitle: cleanSubtitle },
      metadata: {
        ...cardData.metadata,
        isAlreadyEvaluatedByMe: hasAlreadyValidated,
        reviewerArea: myValidation?.label || myDepartmentName,
        assignedTo: { name: realUserName, initial: realUserName.charAt(0) },
      },
    };

    setDrawerData({
      caseId: cardData.rawId!,
      header: updatedHeader,
      availableTabs: [],
      defaultTabId: forceTab || "resumen",
      payload: null,
    });

    try {
      const response = await fetch(`/api/afiliaciones/expedientes/${cardData.rawId}`);
      const result = await response.json();
      if (result.success) {
        setDrawerData({
          caseId: cardData.rawId!,
          header: updatedHeader,
          availableTabs: [
            { id: "resumen", label: "Resumen", hasNotification: false },
            { id: "datos", label: "Datos Completos", hasNotification: false },
            { id: "observaciones", label: "Observaciones", hasNotification: result.data.observations?.length > 0 },
            { id: "documentos", label: "Documentos", hasNotification: result.data.documents?.length > 0 },
            { id: "avales", label: "Avales", hasNotification: false },
            { id: "historial", label: "Historial de Actividad", hasNotification: false },
          ],
          defaultTabId: forceTab || "resumen",
          payload: result.data,
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
      const res = await fetch(`/api/afiliaciones/postulacion/file?url=${encodeURIComponent(url)}`);
      const data = await res.json();
      if (data.success) window.open(data.data.url, "_blank");
    } catch (error) { showToast("No se pudo abrir el documento.", "error"); }
  };

  const handleResolveSingleObservation = async (obsId: number, comment: string) => {
    if (!drawerData) return;
    try {
      const response = await fetch(`/api/afiliaciones/expedientes/observaciones/${obsId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ comment }),
      });
      const result = await response.json();
      if (result.success) {
        showToast("Observación subsanada. Verificando estado del área...", "success");
        const nuevosExpedientes = await fetchExpedientes();
        const expedienteActualizado = nuevosExpedientes.find((e: SmartCaseCardData) => e.rawId === drawerData.caseId);
        if (expedienteActualizado) handleOpenDrawer(expedienteActualizado, "observaciones");
      } else { showToast(result.message || "Error al subsanar", "error"); }
    } catch (error) { showToast("Ocurrió un error al contactar al servidor", "error"); }
  };

  const handleReevaluate = () => {
    setTargetStatus("PENDING");
    setStatusReason("<p>Reapertura del expediente para reevaluación.</p>");
    setShowStatusModal(true);
  };

  const handleReplaceAval = (avalId: number) => {
    showToast(`Solicitando reemplazo para el aval #${avalId}. (En desarrollo)`, "success");
  };

  // --- HANDLERS PARA ARCHIVOS ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setAttachments((prev) => [...prev, ...newFiles]);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (indexToRemove: number) => {
    setAttachments((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  // --- HANDLER DE CONFIRMACIÓN PRINCIPAL ---
  const confirmStatusChange = async () => {
    if (!drawerData) return;

    if (statusReason === "<p></p>" || statusReason.trim() === "") {
      showToast("Debe ingresar un motivo", "error");
      return;
    }

    setIsUpdatingStatus(true);
    try {
      let uploadedUrl = null;
      if (attachments.length > 0) {
        const formData = new FormData();
        formData.append("file", attachments[0]); // Por ahora sube el primero
        formData.append("folder", "afiliaciones/observaciones");
        const uploadRes = await fetch("/api/afiliaciones/postulacion/upload", { method: "POST", body: formData });
        const uploadData = await uploadRes.json();
        if (uploadData.success) uploadedUrl = uploadData.data.url;
      }

      const res = await fetch(`/api/afiliaciones/expedientes/${drawerData.caseId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newStatus: targetStatus,
          reason: statusReason,
          fieldPaths: targetStatus === "OBSERVED" ? observedFieldPaths : undefined,
          attachmentUrl: uploadedUrl,
        }),
      });
      const data = await res.json();

      if (data.success) {
        setShowStatusModal(false);
        setStatusReason("");
        setAttachments([]);
        setObservedFieldPaths([]);
        showToast("Se actualizó el estado correctamente", "success");

        const nuevosExpedientes = await fetchExpedientes();
        const expedienteActualizado = nuevosExpedientes.find((e: SmartCaseCardData) => e.rawId === drawerData.caseId);
        if (expedienteActualizado) {
          handleOpenDrawer(expedienteActualizado, targetStatus === "OBSERVED" ? "observaciones" : "resumen");
        } else { setIsDrawerOpen(false); }
      } else { showToast(data.message, "error"); }
    } catch (error) { showToast("Error de conexión al actualizar estado.", "error"); } 
    finally { setIsUpdatingStatus(false); }
  };

  const generateTimeline = (payload: any) => {
    const events: Array<{ date: Date; title: string; desc: string; icon: React.ReactNode; color: string; auditor?: string | null; }> = [];

    if (payload.createdAt) events.push({ date: new Date(payload.createdAt), title: "Expediente Creado", desc: "El postulante inició su registro.", icon: <FileText size={14} />, color: "bg-slate-100 text-slate-500 border-slate-200" });
    if (payload.submittedAt) events.push({ date: new Date(payload.submittedAt), title: "Expediente Enviado", desc: "El postulante finalizó y envió el formulario a revisión.", icon: <CheckCircle2 size={14} />, color: "bg-blue-100 text-blue-600 border-blue-200" });

    payload.history?.forEach((h: any) => {
      let auditorInfo = null;
      let cleanDesc = h.changeReason || "Actualización de fase realizada por el sistema.";
      const match = cleanDesc.match(/\[Por:\s(.*?)\s-\s(.*?)\]/);
      if (match) { auditorInfo = `${match[1]} (${match[2].replace("_", " ")})`; cleanDesc = cleanDesc.replace(match[0], "").trim(); }

      const isApprove = h.newStatus === "APPROVED" || h.newStatus === "UNDER_EVALUATION" || h.newStatus === "UNDER_EVALUACION" || h.newStatus === "COMPLETED" || h.newStatus === "READY_FOR_PAYMENT";
      const isReject = h.newStatus === "REJECTED";

      events.push({
        date: new Date(h.createdAt),
        title: `Cambio de Estado: ${formatStatusName(h.newStatus)}`,
        desc: cleanDesc,
        auditor: auditorInfo,
        icon: <Activity size={14} />,
        color: isApprove ? "bg-emerald-100 text-emerald-600 border-emerald-200" : isReject ? "bg-red-100 text-red-600 border-red-200" : "bg-amber-100 text-amber-600 border-amber-200",
      });
    });

    payload.areaValidations?.forEach((v: any) => {
      if (v.validatedAt) {
        const isApproved = v.status === "RESOLVED" || v.status === "APPROVED";
        events.push({
          date: new Date(v.validatedAt),
          title: `Validación de Área: ${v.department.replace("_", " ")}`,
          desc: v.comments || (isApproved ? "Área validó conforme." : "El área reportó observaciones."),
          icon: isApproved ? <ShieldCheck size={14} /> : <AlertCircle size={14} />,
          color: isApproved ? "bg-emerald-100 text-emerald-600 border-emerald-200" : "bg-red-100 text-red-600 border-red-200",
        });
      }
    });

    return events.sort((a, b) => b.date.getTime() - a.date.getTime());
  };

  // ===================================================
  // LÓGICA DE HABILITACIÓN DE BOTONES (UNIFICADA)
  // ===================================================
  const reviewerArea = drawerData?.header.metadata.reviewerArea || "";
  const payload = drawerData?.payload;
  const validationsRaw = payload?.validations || [];
  
  const myValidationRaw = validationsRaw.find((v: any) => {
    const deptName = (v.department?.name || "").toUpperCase();
    const deptCode = (v.department?.code || "").toUpperCase();
    const myArea = reviewerArea.toUpperCase();
    return (
      deptName.includes(myArea) || myArea.includes(deptName) ||
      deptCode.includes(myArea) || myArea.includes(deptCode) ||
      (myArea === "ASOCIADOS" && deptName === "ATENCIÓN AL ASOCIADO")
    );
  });

  const areaStatus = myValidationRaw?.status || "PENDING";
  const isAreaFinal = ["APPROVED", "check", "REJECTED", "error"].includes(areaStatus);
  const isAreaObserved = ["OBSERVED", "review", "alert"].includes(areaStatus);

  const allObservations = payload?.observations || [];
  const myPendingObservations = allObservations.filter((obs: any) => {
    const obsDept = (obs.reviewDepartment || "").toUpperCase();
    const myArea = reviewerArea.toUpperCase();
    const isMatch = obsDept.includes(myArea) || myArea.includes(obsDept) || 
      (myArea === "ASOCIADOS" && obsDept === "ATENCIÓN AL ASOCIADO") || (myArea === "LOGISTICA" && obsDept === "LOGÍSTICA");
    return isMatch && obs.status === "PENDING";
  });
  const hasPendingObservations = myPendingObservations.length > 0;

  const isComite = currentUser?.role?.slug === "COMITE_EVALUADOR";
  const isStudent = payload?.affiliateType === "STUDENT";
  const countAvalesAprobados = payload?.approvals?.filter((a: any) => a.status === "APPROVED").length || 0;
  const areEndorsementsReady = isStudent || countAvalesAprobados === 2;

  const logisticaValidation = validationsRaw.find((v: any) => v.department?.code === "LOGISTICA");
  const asociadosValidation = validationsRaw.find((v: any) => v.department?.code === "ASOCIADOS");
  
  const isLogisticaOk = ["APPROVED", "check"].includes(logisticaValidation?.status);
  const isAsociadosOk = ["APPROVED", "check"].includes(asociadosValidation?.status);
  
  const isReadyForComite = isComite ? areEndorsementsReady && isLogisticaOk && isAsociadosOk : true;

  const isClosedFinal = payload ? ["APPROVED", "COMPLETED", "REJECTED", "READY_FOR_PAYMENT"].includes(payload.status) : false;

  const isActionDisabled = isClosedFinal || isAreaFinal || (isComite && !isReadyForComite);

  const disableApproveButton = isActionDisabled || hasPendingObservations;
  const disableResolveButton = isActionDisabled || !isAreaObserved;
  const disableObserveButton = isActionDisabled || isAreaObserved;
  const disableRejectButton = isActionDisabled;

  const renderDrawerContent = (activeTab: string, payload: any) => {
    if (isDrawerLoading || !payload) {
      return (
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <div className="animate-spin w-10 h-10 border-4 border-[#C5A059] border-t-transparent rounded-full"></div>
          <span className="text-sm font-bold text-slate-500">Recopilando datos e historial del expediente...</span>
        </div>
      );
    }

    const header = drawerData?.header;
    const validations = header?.atomicValidations || [];
    const completedCount = validations.filter((v: any) => v.status === "check" || v.status === "APPROVED").length;
    const progressPercentage = validations.length > 0 ? Math.round((completedCount / validations.length) * 100) : 0;

    const submittedDate = payload.submittedAt ? new Date(payload.submittedAt).toLocaleString("es-PE", { dateStyle: "medium", timeStyle: "short" }) : "No enviado";
    const payment = payload.payments?.[0];
    const paymentMethod = payment?.gateway ? payment.gateway.toLowerCase().replace(/_/g, " ") : isStudent ? "Beca Pregrado" : "Pendiente";
    const amount = payment?.totalAmount ? `${payment.currency || "PEN"} ${payment.totalAmount}` : isStudent ? "Gratuito" : "S/ 0.00";

    if (activeTab === "resumen") {
      return (
        <div className="space-y-6 sm:space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div>
            <h3 className="text-[13px] font-bold text-slate-800 mb-3 flex items-center gap-2">Estado del expediente</h3>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3 sm:space-y-4">
              {validations.map((val: any, idx: number) => (
                <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-0 rounded-xl sm:rounded-none bg-slate-50 sm:bg-transparent border border-slate-100 sm:border-none">
                  <div className="flex items-center gap-3 sm:w-1/3">
                    <DynamicIcon name={val.icon} size={16} className="text-slate-500" />
                    <span className="text-[12px] font-bold text-slate-700">{val.label}</span>
                  </div>
                  <div className="sm:w-1/3 flex sm:justify-start">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${val.statusColorClass}`}>
                      <DrawerStatusIcon status={val.status} className="w-3 h-3" />
                      {formatStatusName(val.statusLabel || val.status)}
                    </span>
                  </div>
                  <div className="sm:w-1/3 flex flex-col sm:items-end text-left sm:text-right">
                    <span className={`text-[11px] font-black truncate w-full sm:text-right ${val.status === "check" || val.status === "APPROVED" ? "text-[#C5A059]" : val.status === "error" || val.status === "REJECTED" ? "text-red-500" : "text-slate-400"}`}>
                      {val.assignee?.name || "Sin asignar"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-[13px] font-bold text-slate-800 mb-3">Progreso general</h3>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm">
              <div className="flex items-end justify-between mb-3">
                <span className="text-xs font-medium text-slate-500">{completedCount} de {validations.length} validaciones completadas</span>
                <span className="text-2xl font-black text-slate-800 leading-none">{progressPercentage}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div className="bg-[#C5A059] h-2.5 rounded-full transition-all duration-1000 ease-out" style={{ width: `${progressPercentage}%` }}></div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-[13px] font-bold text-slate-800 mb-3">Información de solicitud</h3>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm">
              <dl className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b border-slate-50 pb-4 gap-1">
                  <dt className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Modalidad</dt>
                  <dd className="text-sm font-bold text-slate-800">{header?.identity.categoryBadge?.label}</dd>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b border-slate-50 pb-4 gap-1">
                  <dt className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fecha de envío</dt>
                  <dd className="text-sm font-bold text-slate-800">{submittedDate}</dd>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b border-slate-50 pb-4 gap-1">
                  <dt className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tipo de pago</dt>
                  <dd className={`text-sm font-bold capitalize ${isStudent ? "text-emerald-600" : "text-slate-800"}`}>{paymentMethod}</dd>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                  <dt className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Monto</dt>
                  <dd className={`text-[15px] font-black ${isStudent ? "text-emerald-600" : "text-[#C5A059]"}`}>{amount}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      );
    }

    if (activeTab === "datos") return <DatosTab payload={payload} />;
    
    // ✅ AQUÍ ESTÁ LA SOLUCIÓN: Pasamos directamente el payload como espera DocumentosTab
    if (activeTab === "documentos") return <DocumentosTab payload={payload} />;
    
    if (activeTab === "observaciones") return <ObservacionesTab payload={payload} onResolveObservation={handleResolveSingleObservation} />;
    if (activeTab === "avales") return <AvalesTab payload={payload} onReplaceAval={handleReplaceAval} />;
    
    if (activeTab === "historial") {
      const timelineEvents = generateTimeline(payload);
      return (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
          <h3 className="text-[15px] font-black text-slate-800 mb-8 flex items-center gap-3 border-b border-slate-100 pb-3">
            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center"><Activity size={16} className="text-slate-600" /></div>
            Historial de Auditoría
          </h3>
          <div className="relative border-l-2 border-slate-100 ml-4 space-y-8 pb-4">
            {timelineEvents.map((event, i) => (
              <div key={i} className="relative pl-8">
                <div className={`absolute -left-[17px] top-1 w-8 h-8 rounded-full border-4 border-white flex items-center justify-center shadow-sm ${event.color}`}>{event.icon}</div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1.5">
                  <h4 className="text-sm font-bold text-slate-800">{event.title}</h4>
                  <span className="text-[11px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md w-max">
                    {event.date.toLocaleString("es-PE", { dateStyle: "long", timeStyle: "short" })}
                  </span>
                </div>
                {event.auditor && (
                  <span className="inline-block mt-1 mb-2 px-2.5 py-1 bg-slate-100 text-[#C5A059] text-[10px] font-black rounded uppercase tracking-wider border border-[#e8d09e]">
                    {event.auditor.includes("SISTEMA") ? "Ejecutado por:" : "Validado por:"} {event.auditor}
                  </span>
                )}
                <p className="text-[13px] font-medium text-slate-600 leading-relaxed bg-slate-50/50 p-3 rounded-xl border border-slate-100">{event.desc}</p>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col relative animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-[calc(100vh-8rem)] pb-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm mb-5 flex flex-col relative z-20">
        <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight leading-none">
              Expedientes de Afiliación
            </h1>
            <p className="text-xs sm:text-sm font-medium text-slate-500 mt-1.5">
              Gestiona, evalúa y resuelve las solicitudes pendientes.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center justify-center gap-1.5 px-4 h-9 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-xs font-bold transition-all shadow-sm focus:outline-none">
              <Download size={14} strokeWidth={2.5} /> Exportar Excel
            </button>
            <button
              onClick={() => setShowWorkflowGuide(true)}
              className="flex items-center justify-center gap-1.5 px-4 h-9 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg text-xs font-bold transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            >
              <Info size={14} strokeWidth={2.5} /> Ver flujo
            </button>
          </div>
        </div>
        <ExpedientesFilterBar filters={filters} onFilterChange={handleFilterChange} totalResults={meta.total} />
      </div>

      <div className="relative z-10">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin w-8 h-8 border-4 border-[#C5A059] border-t-transparent rounded-full"></div>
              <span className="text-sm font-bold text-slate-500">Actualizando expedientes...</span>
            </div>
          </div>
        ) : expedientes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
            {expedientes.map((exp) => (
              <SmartCaseCard key={exp.id} data={exp} onClick={() => handleOpenDrawer(exp)} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-transparent rounded-2xl border-2 border-slate-200 border-dashed animate-in fade-in zoom-in-95 duration-500 mt-4">
            <h3 className="text-xl font-black text-slate-800 tracking-tight mb-2">No hay resultados</h3>
            <button onClick={handleClearFilters} className="group px-5 py-2.5 bg-white border border-slate-200 text-slate-600 hover:text-[#C5A059] hover:bg-[#fdfaf5] rounded-xl font-bold text-sm transition-all shadow-sm flex items-center gap-2 focus:outline-none">
              <RefreshCcw size={16} className="group-hover:-rotate-180 transition-transform duration-500" /> Limpiar filtros
            </button>
          </div>
        )}
      </div>

      <div className="flex-1"></div>

      {expedientes.length > 0 && (
        <div className={`w-full transition-all duration-300 ${isPaginationSticky ? "sticky bottom-4 z-40 mt-8 pointer-events-none" : "mt-8"}`}>
          <div className="w-full pointer-events-auto">
            <ExpedientesPagination
              meta={meta}
              onPageChange={(page) => setMeta((prev) => ({ ...prev, page }))}
              onPageSizeChange={(pageSize) => setMeta((prev) => ({ ...prev, pageSize, page: 1 }))}
              isSticky={isPaginationSticky}
              onToggleSticky={() => setIsPaginationSticky(!isPaginationSticky)}
            />
          </div>
        </div>
      )}

      {isMounted && showWorkflowGuide && <WorkflowGuideModal onClose={() => setShowWorkflowGuide(false)} />}

      {/* MODAL DE ACTUALIZACIÓN DE ESTADO */}
      {isMounted && showStatusModal && createPortal(
          <div className="fixed inset-0 z-[999999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh]">
              {/* Cabecera */}
              <div className="p-6 text-center border-b border-gray-100 bg-gray-50/50 shrink-0">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border ${targetStatus === "REJECTED" ? "bg-red-50 text-red-600 border-red-200" : "bg-amber-100 text-amber-600 border-amber-200"}`}>
                  <AlertTriangle size={28} />
                </div>
                <h2 className="text-xl font-black text-slate-800 tracking-tight">
                  {targetStatus === "OBSERVED" ? "¿Observar Expediente?" : targetStatus === "PENDING" ? "¿Reevaluar Expediente?" : targetStatus === "REJECTED" ? "⚠ ¿Rechazar Definitivamente?" : "¿Otorgar Conformidad?"}
                </h2>
                <p className="text-sm text-slate-500 mt-2 leading-relaxed px-4">
                  Está a punto de cambiar el estado del trámite a <strong className="text-slate-800 uppercase">{formatStatusName(targetStatus)}</strong>. Su nombre quedará registrado en el historial.
                </p>
              </div>

              {/* Cuerpo del Formulario */}
              <div className="p-6 space-y-5 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 flex-1">
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

                {/* LÓGICA EXCLUSIVA SI ES OBSERVADO */}
                {targetStatus === "OBSERVED" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide ml-1">
                        Campos que debe corregir <span className="text-red-500">*</span>
                      </label>
                      {observedFieldPaths.length > 0 && (
                        <span className="text-[11px] font-bold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-full">
                          {observedFieldPaths.length} seleccionados
                        </span>
                      )}
                    </div>

                    {(() => {
                      const isModalApplicantStudent = drawerData?.payload?.affiliateType === "STUDENT" || 
                        drawerData?.header?.identity?.categoryBadge?.label?.toUpperCase().includes("ESTUDIANTE");
                      const activeCategories = OBSERVATION_CATEGORIES.map(
                        (cat) => ({
                          ...cat,
                          fields: cat.fields.filter(
                            (f) => !f.studentOnly || isModalApplicantStudent,
                          ),
                        }),
                      ).filter((cat) => cat.fields.length > 0);

                      const currentCategory = activeCategories.find((c) => c.id === activeObservationCategory) || activeCategories[0];
                      const allCurrentSelected = currentCategory.fields.every((f) => observedFieldPaths.includes(f.key));

                      const toggleAllCategory = () => {
                        let updated = [...observedFieldPaths];
                        currentCategory.fields.forEach((f) => {
                          updated = applyGeographicDependencies(updated, f.key, !allCurrentSelected);
                        });
                        setObservedFieldPaths(updated);
                      };

                      return (
                        <>
                          <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
                            {activeCategories.map((cat) => {
                              const count = cat.fields.filter((f) => observedFieldPaths.includes(f.key)).length;
                              const isActive = currentCategory.id === cat.id;
                              const CatIcon = cat.id === "personal" ? User : cat.id === "academic" ? GraduationCap : cat.id === "employment" ? Briefcase : cat.id === "documents" ? FileText : Users;

                              return (
                                <button
                                  key={cat.id}
                                  type="button"
                                  onClick={() => setActiveObservationCategory(cat.id)}
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${isActive ? "bg-white text-slate-900 shadow-sm border border-slate-200" : "text-slate-600 hover:text-slate-900 hover:bg-white/60"}`}
                                >
                                  <CatIcon size={14} className={isActive ? "text-[#c39254]" : "text-slate-400"} />
                                  <span>{cat.name}</span>
                                  {count > 0 && <span className="ml-0.5 px-1.5 py-0.2 bg-[#c39254] text-white text-[10px] font-extrabold rounded-full">{count}</span>}
                                </button>
                              );
                            })}
                          </div>

                          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2.5">
                            <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
                              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">{currentCategory.name}</span>
                              <button type="button" onClick={toggleAllCategory} className="text-[11px] font-bold text-[#c39254] hover:text-[#7f561e] transition-colors">
                                {allCurrentSelected ? "Deseleccionar todos" : "Seleccionar todos"}
                              </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pr-1">
                              {currentCategory.fields.map((field) => {
                                const checked = observedFieldPaths.includes(field.key);
                                return (
                                  <label
                                    key={field.key}
                                    className={`flex items-center gap-2 p-2 rounded-lg text-xs font-medium cursor-pointer transition-all border ${checked ? "bg-amber-50/80 border-amber-300 text-amber-900 font-semibold" : "bg-white border-slate-200/80 text-slate-700 hover:border-slate-300 hover:bg-slate-50/60"}`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => setObservedFieldPaths((current) => applyGeographicDependencies(current, field.key, !checked))}
                                      className="accent-[#c39254] rounded w-3.5 h-3.5"
                                    />
                                    <span className="truncate">{field.label}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        </>
                      );
                    })()}

                    {observedFieldPaths.length === 0 && (
                      <p className="text-[11px] text-amber-700 font-medium ml-1">
                        ⚠️ Seleccione al menos un campo para que el postulante sepa qué corregir.
                      </p>
                    )}
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
                      <Paperclip size={14} /> Añadir archivo
                    </button>
                    <input type="file" multiple className="hidden" ref={fileInputRef} onChange={handleFileChange} />
                  </div>

                  {attachments.length > 0 ? (
                    <ul className="space-y-2">
                      {attachments.map((file, idx) => (
                        <li key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 border border-gray-200 group hover:border-[#c39254]/50 transition-colors">
                          <div className="flex items-center gap-3 overflow-hidden">
                            <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center shrink-0">
                              <FileText size={16} className="text-slate-400" />
                            </div>
                            <div className="flex flex-col truncate">
                              <span className="text-sm font-bold text-slate-700 truncate">{file.name}</span>
                              <span className="text-[10px] text-slate-400 font-medium">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                            </div>
                          </div>
                          <button onClick={() => removeFile(idx)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors shrink-0 opacity-0 group-hover:opacity-100">
                            <X size={16} strokeWidth={2.5} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div onClick={() => fileInputRef.current?.click()} className="w-full py-5 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center text-slate-400 hover:border-[#c39254] hover:bg-[#c39254]/5 hover:text-[#c39254] transition-all cursor-pointer group">
                      <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center mb-2 group-hover:bg-[#c39254]/10 transition-colors">
                        <UploadCloud size={20} />
                      </div>
                      <span className="text-sm font-bold">Clic para adjuntar archivos</span>
                      <span className="text-xs font-medium opacity-70">JPG, PNG, PDF permitidos</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 pt-4 border-t border-gray-100 flex gap-3 shrink-0 bg-white">
                <button
                  onClick={() => { setShowStatusModal(false); setAttachments([]); setStatusReason(""); setObservedFieldPaths([]); }}
                  className="flex-1 py-3.5 rounded-xl border-2 border-gray-200 text-slate-600 font-bold text-sm hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmStatusChange}
                  disabled={isUpdatingStatus || statusReason === "<p></p>" || statusReason.trim() === "" || (targetStatus === "OBSERVED" && observedFieldPaths.length === 0)}
                  className={`flex-1 py-3.5 rounded-xl text-white font-black tracking-wide text-sm shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all ${targetStatus === "OBSERVED" ? "bg-amber-500 hover:bg-amber-600" : targetStatus === "REJECTED" ? "bg-red-600 hover:bg-red-700" : "bg-[#c39254] hover:bg-[#a3722a]"}`}
                >
                  {isUpdatingStatus ? "Actualizando..." : "Sí, confirmar"}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      <InspectionDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        data={drawerData}
        renderContent={renderDrawerContent}
        onReevaluate={handleReevaluate}
        evaluationActions={
          drawerData && !isDrawerLoading ? (
            <>
              <button
                onClick={() => { setTargetStatus("APPROVED"); setShowStatusModal(true); }}
                disabled={disableApproveButton}
                className="flex items-center gap-2 h-9 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:grayscale"
              >
                <CheckCircle2 size={16} /> Otorgar Conformidad
              </button>

              <button
                onClick={() => { setTargetStatus("RESOLVED"); setShowStatusModal(true); }}
                disabled={disableResolveButton}
                className="flex items-center gap-2 h-9 px-4 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 text-xs font-bold transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:grayscale"
              >
                <CheckCircle2 size={16} /> Subsanar
              </button>

              <button
                onClick={() => { setTargetStatus("OBSERVED"); setShowStatusModal(true); }}
                disabled={disableObserveButton}
                className="flex items-center gap-2 h-9 px-4 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:grayscale"
              >
                <AlertCircle size={16} /> Observar
              </button>

              <button
                onClick={() => { setTargetStatus("REJECTED"); setShowStatusModal(true); }}
                disabled={disableRejectButton}
                className="flex items-center gap-2 h-9 px-3 rounded-lg text-red-500 hover:bg-red-50 text-xs font-bold transition-colors ml-auto disabled:opacity-50 disabled:cursor-not-allowed disabled:grayscale"
              >
                <XCircle size={16} /> Rechazar Definitivo
              </button>
            </>
          ) : null
        }
      />

      {isMounted && toastMessage && createPortal(
          <div className="fixed bottom-6 right-6 z-[999999999] animate-in slide-in-from-bottom-5 fade-in duration-300">
            <div className={`flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-[0_10px_40px_-15px_rgba(0,0,0,0.3)] border ${toastMessage.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-800"}`}>
              {toastMessage.type === "success" ? <CheckCircle2 size={22} className="text-emerald-500" /> : <XCircle size={22} className="text-red-500" />}
              <span className="font-bold text-sm">{toastMessage.title}</span>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}