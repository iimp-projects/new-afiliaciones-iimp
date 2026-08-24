"use client";

import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { SmartCaseCard } from "@/modules/shared/Components/SmartCaseCard/SmartCaseCard";
import { ExpedientesFilterBar } from "../Components/ExpedientesFilterBar";
import { ExpedientesPagination } from "../Components/ExpedientesPagination";
import { InspectionDrawer } from "@/modules/shared/Components/InspectionDrawer/InspectionDrawer";
import type { SmartCaseCardData } from "@/modules/shared/Components/SmartCaseCard/types";
import type { DrawerData } from "@/modules/shared/Components/InspectionDrawer/types";
import { RefreshCcw, Info, AlertCircle, XCircle, CheckCircle2, Download } from "lucide-react";

import { getDepartmentLabelByRole } from "../Utils/expedientes.utils";
import { StatusUpdateModal } from "../Components/StatusUpdateModal";
import { ResumenTab } from "../Components/Drawer/Tabs/ResumenTab";
import { DatosTab } from "../Components/Drawer/Tabs/DatosTab";
import { DocumentosTab } from "../Components/Drawer/Tabs/DocumentosTab";
import { ObservacionesTab } from "../Components/Drawer/Tabs/ObservacionesTab";
// IMPORTAMOS EL NUEVO TAB DE AVALES
import { AvalesTab } from "../Components/Drawer/Tabs/AvalesTab"; 
import { WorkflowGuideModal } from "../Components/WorkflowGuideModal";


export function ExpedientesWorkspace({ currentUser }: { currentUser?: any }) {
  const [expedientes, setExpedientes] = useState<SmartCaseCardData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDrawerLoading, setIsDrawerLoading] = useState(false);
  const [meta, setMeta] = useState({ total: 0, page: 1, pageSize: 8, totalPages: 1 });
  const [isMounted, setIsMounted] = useState(false);

  const [isPaginationSticky, setIsPaginationSticky] = useState(true);

  const [drawerData, setDrawerData] = useState<DrawerData<any> | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showWorkflowGuide, setShowWorkflowGuide] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [targetStatus, setTargetStatus] = useState<string>("");

  const [toastMessage, setToastMessage] = useState<{ title: string; type: "success" | "error" } | null>(null);

  const [filters, setFilters] = useState({
    search: "", status: "Todos", modality: "Todos", assignedTo: "Todos", logisticValidation: "Todos",
    associateValidation: "Todos", comiteValidation: "Todos", legalValidation: "Todos", comunicacionesValidation: "Todos", 
    paymentStatus: "Todos", dateFrom: "", dateTo: "", orderBy: "Más recientes",
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
      search: "", status: "Todos", modality: "Todos", assignedTo: "Todos", logisticValidation: "Todos",
      associateValidation: "Todos", comiteValidation: "Todos", legalValidation: "Todos", comunicacionesValidation: "Todos", 
      paymentStatus: "Todos", dateFrom: "", dateTo: "", orderBy: "Más recientes",
    });
    setMeta((prev) => ({ ...prev, page: 1 }));
  };

  const handleOpenDrawer = async (cardData: SmartCaseCardData, forceTab?: string) => {
    setIsDrawerLoading(true);
    setIsDrawerOpen(true);

    const validations = cardData.atomicValidations || [];
    const myDepartmentName = getDepartmentLabelByRole(currentUser?.role?.slug);
    const myValidation = validations.find((v: any) => v.label.toLowerCase() === myDepartmentName.toLowerCase()) || validations[0];
    
    const hasAlreadyValidated = myValidation && ["APPROVED", "check", "REJECTED"].includes(myValidation.status);
      
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

    setDrawerData({ caseId: cardData.rawId!, header: updatedHeader, availableTabs: [], defaultTabId: forceTab || "resumen", payload: null });

    try {
      const response = await fetch(`/api/afiliaciones/expedientes/${cardData.rawId}`);
      const result = await response.json();
      if (result.success) {
        setDrawerData({
          caseId: cardData.rawId!,
          header: updatedHeader,
          // AQUÍ CAMBIAMOS LOS TABS (AGREGAMOS AVALES, QUITAMOS HISTORIAL)
          availableTabs: [
            { id: "resumen", label: "Resumen", hasNotification: false },
            { id: "datos", label: "Datos Completos", hasNotification: false },
            { id: "observaciones", label: "Observaciones", hasNotification: result.data.observations?.length > 0 },
            { id: "documentos", label: "Documentos", hasNotification: result.data.documents?.length > 0 },
            { id: "avales", label: "Avales", hasNotification: false }, 
          ],
          defaultTabId: forceTab || "resumen",
          payload: result.data,
        });
      }
    } catch (error) { console.error(error); } finally { setIsDrawerLoading(false); }
  };

  const handleOpenSecureDocument = async (url: string) => {
    try {
      const res = await fetch(`/api/afiliaciones/postulacion/file?url=${encodeURIComponent(url)}`);
      const data = await res.json();
      if (data.success) window.open(data.data.url, "_blank");
    } catch (error) { showToast("No se pudo abrir el documento.", "error"); }
  };

  const handleConfirmStatusChange = async (status: string, reasonHtml: string, files: File[]) => {
    if (!drawerData) return;
    try {
      let uploadedUrl = null;
      if (files.length > 0) {
        const formData = new FormData();
        formData.append("file", files[0]);
        formData.append("folder", "afiliaciones/observaciones");
        const uploadRes = await fetch("/api/afiliaciones/postulacion/upload", { method: "POST", body: formData });
        const uploadData = await uploadRes.json();
        if (uploadData.success) uploadedUrl = uploadData.data.url;
      }

      const res = await fetch(`/api/afiliaciones/expedientes/${drawerData.caseId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newStatus: status, reason: reasonHtml, attachmentUrl: uploadedUrl }),
      });
      const data = await res.json();

      if (data.success) {
        setShowStatusModal(false);
        showToast("Se actualizó el estado del área correctamente", "success");
        const nuevosExpedientes = await fetchExpedientes();
        const expedienteActualizado = nuevosExpedientes.find((e: SmartCaseCardData) => e.rawId === drawerData.caseId);
        if (expedienteActualizado) {
          handleOpenDrawer(expedienteActualizado, status === "OBSERVED" ? "observaciones" : "resumen");
        } else { setIsDrawerOpen(false); }
      } else { showToast(data.message, "error"); }
    } catch (error) { showToast("Error de conexión al actualizar estado.", "error"); }
  };

  const handleResolveSingleObservation = async (obsId: number, comment: string) => {
    if (!drawerData) return;
    try {
      const response = await fetch(`/api/afiliaciones/expedientes/observaciones/${obsId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment }),
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

  const handleReevaluate = () => { setTargetStatus("PENDING"); setShowStatusModal(true); };

  // Acción dummy para reemplazar el aval en la UI (puedes conectar tu API luego aquí)
  const handleReplaceAval = (avalId: number) => {
    showToast(`Solicitando reemplazo para el aval #${avalId}. (En desarrollo)`, "success");
  };

  const renderDrawerContent = (activeTab: string, payload: any) => {
    if (isDrawerLoading || !payload) {
      return (
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <div className="animate-spin w-10 h-10 border-4 border-[#C5A059] border-t-transparent rounded-full"></div>
          <span className="text-sm font-bold text-slate-500">Recopilando datos e historial del expediente...</span>
        </div>
      );
    }
    if (activeTab === "resumen") return <ResumenTab header={drawerData?.header} payload={payload} />;
    if (activeTab === "datos") return <DatosTab payload={payload} />;
    if (activeTab === "documentos") return <DocumentosTab documents={payload.documents || []} onOpenDocument={handleOpenSecureDocument} />;
    if (activeTab === "observaciones") return <ObservacionesTab payload={payload} onResolveObservation={handleResolveSingleObservation} />;
    if (activeTab === "avales") return <AvalesTab payload={payload} onReplaceAval={handleReplaceAval} />; // AQUÍ INYECTAMOS AVALES
    return null;
  };

  const isActionDisabled = drawerData?.header.metadata.isAlreadyEvaluatedByMe;
  const reviewerArea = drawerData?.header.metadata.reviewerArea || "";
  
  const validationsRaw = drawerData?.payload?.validations || [];
  const myValidationRaw = validationsRaw.find((v: any) => {
    const deptName = (v.department?.name || "").toUpperCase();
    const deptCode = (v.department?.code || "").toUpperCase();
    const myArea = reviewerArea.toUpperCase();
    return deptName.includes(myArea) || myArea.includes(deptName) || 
           deptCode.includes(myArea) || myArea.includes(deptCode) ||
           (myArea === "ASOCIADOS" && deptName === "ATENCIÓN AL ASOCIADO");
  });
  
  const areaStatus = myValidationRaw?.status || "PENDING"; 
  const allObservations = drawerData?.payload?.observations || [];
  const myPendingObservations = allObservations.filter((obs: any) => {
    const obsDept = (obs.reviewDepartment || "").toUpperCase();
    const myArea = reviewerArea.toUpperCase();
    const isMatch = obsDept.includes(myArea) || myArea.includes(obsDept) || 
                   (myArea === "ASOCIADOS" && obsDept === "ATENCIÓN AL ASOCIADO") ||
                   (myArea === "LOGISTICA" && obsDept === "LOGÍSTICA");
    return isMatch && obs.status === "PENDING";
  });
  
  const hasPendingObservations = myPendingObservations.length > 0;
  const isAreaFinal = ["APPROVED", "check", "REJECTED", "error"].includes(areaStatus);
  const isAreaObserved = ["OBSERVED", "review", "alert"].includes(areaStatus);

  const disableApproveButton = isAreaFinal || hasPendingObservations || isActionDisabled;
  const disableResolveButton = isAreaFinal || !isAreaObserved || isActionDisabled;
  const disableObserveButton = isAreaFinal || isAreaObserved || isActionDisabled;
  const disableRejectButton = isAreaFinal || isActionDisabled;

  return (
    <div className="flex flex-col relative animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-[calc(100vh-8rem)] pb-4">
      
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm mb-5 flex flex-col relative z-20">
        <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight leading-none">Expedientes de Afiliación</h1>
            <p className="text-xs sm:text-sm font-medium text-slate-500 mt-1.5">Gestiona, evalúa y resuelve las solicitudes pendientes.</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center justify-center gap-1.5 px-4 h-9 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-xs font-bold transition-all shadow-sm focus:outline-none">
              <Download size={14} strokeWidth={2.5} /> Exportar Excel
            </button>
            <button onClick={() => setShowWorkflowGuide(true)} className="flex items-center justify-center gap-1.5 px-4 h-9 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg text-xs font-bold transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50">
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
            {expedientes.map((exp) => <SmartCaseCard key={exp.id} data={exp} onClick={() => handleOpenDrawer(exp)} />)}
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

      {isMounted && showStatusModal && <StatusUpdateModal targetStatus={targetStatus} onClose={() => setShowStatusModal(false)} onConfirm={handleConfirmStatusChange} />}
      {isMounted && showWorkflowGuide && <WorkflowGuideModal onClose={() => setShowWorkflowGuide(false)} />}

      <InspectionDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        data={drawerData}
        renderContent={renderDrawerContent}
        onReevaluate={handleReevaluate}
        evaluationActions={
          drawerData && !isDrawerLoading ? (
            <>
              <button onClick={() => { setTargetStatus("APPROVED"); setShowStatusModal(true); }} disabled={disableApproveButton} className="flex items-center gap-2 h-9 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:grayscale">
                <CheckCircle2 size={16} /> Otorgar Conformidad
              </button>
              
              <button onClick={() => { setTargetStatus("RESOLVED"); setShowStatusModal(true); }} disabled={disableResolveButton} className="flex items-center gap-2 h-9 px-4 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 text-xs font-bold transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:grayscale">
                <CheckCircle2 size={16} /> Subsanar
              </button>
              
              <button onClick={() => { setTargetStatus("OBSERVED"); setShowStatusModal(true); }} disabled={disableObserveButton} className="flex items-center gap-2 h-9 px-4 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:grayscale">
                <AlertCircle size={16} /> Observar
              </button>
              
              <button onClick={() => { setTargetStatus("REJECTED"); setShowStatusModal(true); }} disabled={disableRejectButton} className="flex items-center gap-2 h-9 px-3 rounded-lg text-red-500 hover:bg-red-50 text-xs font-bold transition-colors ml-auto disabled:opacity-50 disabled:cursor-not-allowed disabled:grayscale">
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
        </div>, document.body
      )}
    </div>
  );
}