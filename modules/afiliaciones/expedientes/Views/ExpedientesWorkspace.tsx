"use client";

import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { SmartCaseCard } from "@/modules/shared/Components/SmartCaseCard/SmartCaseCard";
import { ExpedientesFilterBar } from "../Components/ExpedientesFilterBar";
import { ExpedientesPagination } from "../Components/ExpedientesPagination";
import { InspectionDrawer } from "@/modules/shared/Components/InspectionDrawer/InspectionDrawer";
import type { SmartCaseCardData } from "@/modules/shared/Components/SmartCaseCard/types";
import type { DrawerData } from "@/modules/shared/Components/InspectionDrawer/types";
import { RefreshCcw, Info, AlertCircle, XCircle, CheckCircle2, Download, Mail, Send } from "lucide-react"; 

import { getDepartmentLabelByRole } from "../Utils/expedientes.utils";
import { ResumenTab } from "../Components/Drawer/Tabs/ResumenTab";
import { DatosTab } from "../Components/Drawer/Tabs/DatosTab";
import { DocumentosTab } from "../Components/Drawer/Tabs/DocumentosTab";
import { ObservacionesTab } from "../Components/Drawer/Tabs/ObservacionesTab";
import { AvalesTab } from "../Components/Drawer/Tabs/AvalesTab";
import { ComiteTab } from "../Components/Drawer/Tabs/ComiteTab"; // <-- IMPORTAMOS EL NUEVO TAB
import { WorkflowGuideModal } from "../Components/WorkflowGuideModal";
import { UpdateStatusModal } from "../Components/Modals/UpdateStatusModal"; 
import { ReplaceAvalModal } from "../Components/Modals/ReplaceAvalModal";

export function ExpedientesWorkspace({ currentUser }: { currentUser?: any }) {
  const [expedientes, setExpedientes] = useState<SmartCaseCardData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDrawerLoading, setIsDrawerLoading] = useState(false);
  const [meta, setMeta] = useState({ total: 0, page: 1, pageSize: 8, totalPages: 1 });
  const [isMounted, setIsMounted] = useState(false);
  const [isPaginationSticky, setIsPaginationSticky] = useState(false);

  const [drawerData, setDrawerData] = useState<DrawerData<any> | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showWorkflowGuide, setShowWorkflowGuide] = useState(false);
  
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [targetStatus, setTargetStatus] = useState<string>("");

  const [replaceAvalTarget, setReplaceAvalTarget] = useState<{ applicationId: number; approvalId: number } | null>(null);
  
  const [resendAvalTarget, setResendAvalTarget] = useState<{ approvalId: number; sponsorName: string; sponsorEmail: string } | null>(null);
  const [isResending, setIsResending] = useState(false);

  // ESTADOS DEL COMITÉ
  const [notifyComiteTarget, setNotifyComiteTarget] = useState<number | null>(null);
  const [isNotifying, setIsNotifying] = useState(false);
  const [comiteMembers, setComiteMembers] = useState<{id: number, name: string}[]>([]);
  const [selectedComiteMember, setSelectedComiteMember] = useState<string>("ALL");

  const [toastMessage, setToastMessage] = useState<{ title: string; type: "success" | "error" } | null>(null);
  const [filters, setFilters] = useState({ search: "", status: "Todos", modality: "Todos", assignedTo: "Todos", logisticValidation: "Todos", associateValidation: "Todos", comiteValidation: "Todos", legalValidation: "Todos", comunicacionesValidation: "Todos", paymentStatus: "Todos", dateFrom: "", dateTo: "", orderBy: "Más recientes" });

  useEffect(() => { setIsMounted(true); }, []);

  const showToast = (title: string, type: "success" | "error" = "success") => {
    setToastMessage({ title, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchExpedientes = useCallback(async () => {
    setIsLoading(true);
    try {
      const queryParams = new URLSearchParams({ page: meta.page.toString(), pageSize: meta.pageSize.toString() });
      Object.entries(filters).forEach(([key, value]) => { if (value && value !== "Todos") queryParams.append(key, value); });
      const response = await fetch(`/api/afiliaciones/expedientes?${queryParams.toString()}`);
      const result = await response.json();
      if (result.success) {
        setExpedientes(result.data);
        setMeta(result.meta);
        return result.data;
      }
    } catch (error) { console.error(error); } finally { setIsLoading(false); }
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
    setFilters({ search: "", status: "Todos", modality: "Todos", assignedTo: "Todos", logisticValidation: "Todos", associateValidation: "Todos", comiteValidation: "Todos", legalValidation: "Todos", comunicacionesValidation: "Todos", paymentStatus: "Todos", dateFrom: "", dateTo: "", orderBy: "Más recientes" });
    setMeta((prev) => ({ ...prev, page: 1 }));
  };

  const handleOpenDrawer = async (cardData: SmartCaseCardData, forceTab?: string) => {
    setIsDrawerLoading(true);
    setIsDrawerOpen(true);

    const isAdmin = currentUser?.role?.slug === "SUPER_ADMIN" || currentUser?.role?.slug === "SYSTEM_ADMIN";
    const validations = cardData.atomicValidations || [];
    const myDepartmentName = getDepartmentLabelByRole(currentUser?.role?.slug);
    const myValidation = validations.find((v: any) => v.label.toLowerCase() === myDepartmentName.toLowerCase()) || validations[0];
    
    const hasAlreadyValidated = !isAdmin && myValidation && ["APPROVED", "check", "REJECTED", "error"].includes(myValidation.status);
    const dniMatch = cardData.identity.subtitle.match(/DNI\s*(\d+)/i);
    const cleanSubtitle = dniMatch ? `DNI: ${dniMatch[1]}` : cardData.identity.subtitle;
    const realUserName = currentUser ? `${currentUser.person.firstName} ${currentUser.person.paternalLastName}` : "Administrador";

    const updatedHeader = {
      ...cardData,
      identity: { ...cardData.identity, subtitle: cleanSubtitle },
      metadata: {
        ...cardData.metadata,
        isAlreadyEvaluatedByMe: hasAlreadyValidated,
        reviewerArea: isAdmin ? (currentUser?.role?.name || currentUser?.role?.slug?.replace(/_/g, " ")) : (myValidation?.label || myDepartmentName),
        assignedTo: { name: realUserName, initial: realUserName.charAt(0) },
      },
    };

    setDrawerData({ caseId: cardData.rawId!, header: updatedHeader, availableTabs: [], defaultTabId: forceTab || "resumen", payload: null });

    try {
      const response = await fetch(`/api/afiliaciones/expedientes/${cardData.rawId}`);
      const result = await response.json();
      
      if (result.success) {
        const isStudentApp = result.data.affiliateType === "STUDENT";
        
        const dynamicTabs = [
          { id: "resumen", label: "Resumen", hasNotification: false },
          { id: "datos", label: "Datos Completos", hasNotification: false },
        ];

        if (!isStudentApp) {
          dynamicTabs.push({ id: "avales", label: "Avales", hasNotification: false });
        }

        dynamicTabs.push(
          { id: "comite", label: "Comité Evaluador", hasNotification: false }, // <-- AÑADIMOS EL TAB
          { id: "documentos", label: "Documentos", hasNotification: result.data.documents?.length > 0 },
          { id: "observaciones", label: "Observaciones", hasNotification: result.data.observations?.length > 0 }
        );

        const finalDefaultTab = (forceTab === "avales" && isStudentApp) ? "resumen" : (forceTab || "resumen");

        setDrawerData({
          caseId: cardData.rawId!,
          header: updatedHeader,
          availableTabs: dynamicTabs,
          defaultTabId: finalDefaultTab,
          payload: result.data,
        });
      }
    } catch (error) { console.error(error); } finally { setIsDrawerLoading(false); }
  };

  const handleResolveSingleObservation = async (obsId: number, comment: string) => {
    if (!drawerData) return;
    try {
      const response = await fetch(`/api/afiliaciones/expedientes/observaciones/${obsId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ comment }) });
      const result = await response.json();
      if (result.success) {
        showToast("Observación subsanada. Verificando estado del área...", "success");
        const nuevosExpedientes = await fetchExpedientes();
        const expedienteActualizado = nuevosExpedientes.find((e: SmartCaseCardData) => e.rawId === drawerData.caseId);
        if (expedienteActualizado) handleOpenDrawer(expedienteActualizado, "observaciones");
      } else { showToast(result.message || "Error al subsanar", "error"); }
    } catch (error) { showToast("Ocurrió un error al contactar al servidor", "error"); }
  };

  // MANEJADORES DEL COMITÉ
  const handleOpenNotifyModal = async (appId: number) => {
    setNotifyComiteTarget(appId);
    setSelectedComiteMember("ALL");
    try {
      const res = await fetch('/api/usuarios/comite');
      const data = await res.json();
      if (data.success) setComiteMembers(data.data);
    } catch (e) { console.error(e); }
  };

  const executeNotifyComite = async () => {
    if (!notifyComiteTarget) return;
    setIsNotifying(true);
    try {
      const response = await fetch(`/api/afiliaciones/expedientes/${notifyComiteTarget}/notificar-comite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId: selectedComiteMember })
      });
      const result = await response.json();
      
      if (result.success) {
        showToast("Se envió el expediente al Comité y se guardó en el Historial.", "success");
        setNotifyComiteTarget(null);
        // Recargamos silenciosamente los datos
        const nuevosExpedientes = await fetchExpedientes();
        const expedienteActualizado = nuevosExpedientes.find((e: SmartCaseCardData) => e.rawId === drawerData?.caseId);
        if (expedienteActualizado && drawerData?.caseId) handleOpenDrawer(expedienteActualizado, "comite");
      } else {
        showToast(result.error || "No se pudo notificar al comité.", "error");
      }
    } catch (error) {
      showToast("Error de conexión al notificar.", "error");
    } finally {
      setIsNotifying(false);
    }
  };


  const isAdmin = currentUser?.role?.slug === "SUPER_ADMIN" || currentUser?.role?.slug === "SYSTEM_ADMIN";
  const reviewerArea = drawerData?.header.metadata.reviewerArea || "";
  const payload = drawerData?.payload;
  const validationsRaw = payload?.validations || [];
  
  const myValidationRaw = validationsRaw.find((v: any) => {
    const deptName = (v.department?.name || "").toUpperCase();
    const deptCode = (v.department?.code || "").toUpperCase();
    const myArea = reviewerArea.toUpperCase();
    return (deptName.includes(myArea) || myArea.includes(deptName) || deptCode.includes(myArea) || myArea.includes(deptCode) || (myArea === "ASOCIADOS" && deptName === "ATENCIÓN AL ASOCIADO"));
  });

  const areaStatus = myValidationRaw?.status || "PENDING";
  const isAreaFinal = ["APPROVED", "check", "REJECTED", "error"].includes(areaStatus);
  const isAreaObserved = ["OBSERVED", "review", "alert"].includes(areaStatus);
  const isAreaResolved = ["RESOLVED"].includes(areaStatus);
  
  const allObservations = payload?.observations || [];
  const myPendingObservations = allObservations.filter((obs: any) => {
    const obsDept = (obs.reviewDepartment || "").toUpperCase();
    const myArea = reviewerArea.toUpperCase();
    return (obsDept.includes(myArea) || myArea.includes(obsDept) || (myArea === "ASOCIADOS" && obsDept === "ATENCIÓN AL ASOCIADO") || (myArea === "LOGISTICA" && obsDept === "LOGÍSTICA")) && obs.status === "PENDING";
  });
  
  const hasPendingObservations = myPendingObservations.length > 0;
  const isComite = currentUser?.role?.slug === "COMITE_EVALUADOR";
  const isStudent = payload?.affiliateType === "STUDENT";
  const countAvalesAprobados = payload?.approvals?.filter((a: any) => a.status === "APPROVED").length || 0;
  const areEndorsementsReady = isStudent || countAvalesAprobados === 2;
  const logisticaValidation = validationsRaw.find((v: any) => v.department?.code === "LOGISTICA");
  const asociadosValidation = validationsRaw.find((v: any) => v.department?.code === "ASOCIADOS");
  const isLogisticaOk = ["APPROVED", "check", "RESOLVED"].includes(logisticaValidation?.status);
  const isAsociadosOk = ["APPROVED", "check", "RESOLVED"].includes(asociadosValidation?.status);
  const isReadyForComite = isComite ? areEndorsementsReady && isLogisticaOk && isAsociadosOk : true;
  
  const isClosedFinal = payload ? ["APPROVED", "COMPLETED", "REJECTED", "READY_FOR_PAYMENT"].includes(payload.status) : false;

  let disableApproveButton = false;
  let disableResolveButton = false;
  let disableObserveButton = false;
  let disableRejectButton = false;

  if (isClosedFinal) {
    disableApproveButton = true;
    disableResolveButton = true;
    disableObserveButton = true;
    disableRejectButton = true;
  } else if (isAdmin) {
    const hasAnyObserved = validationsRaw.some((v:any) => ["OBSERVED", "review", "alert"].includes(v.status));
    disableResolveButton = !hasAnyObserved; 
    disableApproveButton = false;
    disableObserveButton = false;
    disableRejectButton = false;
  } else {
    const isActionDisabled = isAreaFinal || (isComite && !isReadyForComite);
    
    if (isAreaResolved) {
      disableApproveButton = false;
      disableObserveButton = false;
      disableResolveButton = true; 
      disableRejectButton = false;
    } else {
      disableApproveButton = isActionDisabled || hasPendingObservations;
      disableResolveButton = isActionDisabled || !isAreaObserved;
      disableObserveButton = isActionDisabled || isAreaObserved;
      disableRejectButton = isActionDisabled;
    }
  }

 const renderDrawerContent = (activeTab: string, payload: any) => {
    if (isDrawerLoading || !payload) return (
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <div className="animate-spin w-10 h-10 border-4 border-[#C5A059] border-t-transparent rounded-full"></div>
          <span className="text-sm font-bold text-slate-500">Recopilando datos e historial del expediente...</span>
        </div>
      );
    
    if (activeTab === "resumen") return <ResumenTab payload={payload} header={drawerData?.header} isStudent={isStudent} />;
    if (activeTab === "datos") return <DatosTab payload={payload} />;
    
    if (activeTab === "avales") return (
      <AvalesTab 
        payload={payload} 
        onReplaceAval={(approvalId: number) => {
          setReplaceAvalTarget({
            applicationId: drawerData?.caseId as number,
            approvalId: approvalId,
          });
        }} 
        onResendEmail={(approvalId: number, sponsorEmail: string) => {
          const approval = payload.approvals.find((a: any) => a.id === approvalId);
          const sponsorPerson = approval?.sponsorPerson;
          
          const sponsorName = sponsorPerson 
            ? `${sponsorPerson.firstName} ${sponsorPerson.paternalLastName}` 
            : "Aval Institucional";

          setResendAvalTarget({ approvalId, sponsorName, sponsorEmail });
        }}
      />
    );
    
    // RENDERIZAMOS EL NUEVO TAB
    if (activeTab === "comite") return <ComiteTab payload={payload} />;
    if (activeTab === "documentos") return <DocumentosTab payload={payload} />;
    if (activeTab === "observaciones") return <ObservacionesTab payload={payload} onResolveObservation={handleResolveSingleObservation} />;
    return null;
  };

  const executeResendEmail = async () => {
    if (!resendAvalTarget || !drawerData) return;
    
    if (resendAvalTarget.sponsorEmail === "No registrado") {
        showToast("Este aval no tiene un correo válido registrado.", "error");
        return;
    }

    setIsResending(true);
    try {
      const response = await fetch(`/api/afiliaciones/postulacion/avales/reenviar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: drawerData.caseId,
          approvalId: resendAvalTarget.approvalId,
          sponsorEmail: resendAvalTarget.sponsorEmail
        })
      });
      const result = await response.json();
      
      if (result.success) {
        showToast("Se reenvió la invitación y se registró en el historial.", "success");
        setResendAvalTarget(null);
        
        const nuevosExpedientes = await fetchExpedientes();
        const expedienteActualizado = nuevosExpedientes.find((e: SmartCaseCardData) => e.rawId === drawerData.caseId);
        if (expedienteActualizado) {
          handleOpenDrawer(expedienteActualizado, "avales");
        }
      } else {
        showToast(result.error || "Error al reenviar el correo.", "error");
      }
    } catch (error) {
      showToast("Error de conexión al reenviar correo.", "error");
    } finally {
      setIsResending(false);
    }
  };


  return (
    <div className="flex flex-col relative animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-[calc(100vh-8rem)] pb-4">
      
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm mb-5 flex flex-col relative z-20">
        <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight leading-none">Expedientes de Afiliación</h1>
            <p className="text-xs sm:text-sm font-medium text-slate-500 mt-1.5">Gestiona, evalúa y resuelve las solicitudes pendientes.</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center justify-center gap-1.5 px-4 h-9 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-xs font-bold transition-all shadow-sm focus:outline-none"><Download size={14} strokeWidth={2.5} /> Exportar Excel</button>
            <button onClick={() => setShowWorkflowGuide(true)} className="flex items-center justify-center gap-1.5 px-4 h-9 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg text-xs font-bold transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"><Info size={14} strokeWidth={2.5} /> Ver flujo</button>
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
            {expedientes.map((exp) => {
              const isCardStudent = exp.identity.categoryBadge?.label?.toLowerCase().includes("estudiante");

              // CÁLCULO DE BLOQUEO DE BOTÓN NOTIFICAR
              const logValidation = exp.atomicValidations?.find(v => v.label.toUpperCase().includes("LOGÍSTICA") || v.label.toUpperCase().includes("LOGISTICA"));
              const asocValidation = exp.atomicValidations?.find(v => v.label.toUpperCase().includes("ASOCIADO"));
              const avalValidation = exp.atomicValidations?.find(v => v.label.toUpperCase().includes("AVAL"));

              const isLogOk = ["check", "APPROVED", "RESOLVED"].includes(logValidation?.status as string);
              const isAsocOk = ["check", "APPROVED", "RESOLVED"].includes(asocValidation?.status as string);
              const isAvalOk = isCardStudent || ["check", "APPROVED", "RESOLVED"].includes(avalValidation?.status as string);
              
              // Solo se activa si las áreas obligatorias están en verde
              const isReadyToNotify = isLogOk && isAsocOk && isAvalOk;

              return (
                <SmartCaseCard 
                  key={exp.id} 
                  data={exp} 
                  onClick={() => handleOpenDrawer(exp)}  
                 onViewAvales={isCardStudent ? undefined : () => handleOpenDrawer(exp, "avales")}
                  // Si está listo, le pasamos la función, si no, le pasamos undefined para que se pinte en gris
                  onNotifyCommittee={isReadyToNotify ? () => handleOpenNotifyModal(exp.rawId as number) : undefined}
                />
              )
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-transparent rounded-2xl border-2 border-slate-200 border-dashed animate-in fade-in zoom-in-95 duration-500 mt-4">
            <h3 className="text-xl font-black text-slate-800 tracking-tight mb-2">No hay resultados</h3>
            <button onClick={handleClearFilters} className="group px-5 py-2.5 bg-white border border-slate-200 text-slate-600 hover:text-[#C5A059] hover:bg-[#fdfaf5] rounded-xl font-bold text-sm transition-all shadow-sm flex items-center gap-2 focus:outline-none"><RefreshCcw size={16} className="group-hover:-rotate-180 transition-transform duration-500" /> Limpiar filtros</button>
          </div>
        )}
      </div>

      <div className="flex-1"></div>

      {expedientes.length > 0 && (
        <div className={`w-full transition-all duration-300 ${isPaginationSticky ? "sticky bottom-4 z-40 mt-8 pointer-events-none" : "mt-8"}`}>
          <div className="w-full pointer-events-auto">
            <ExpedientesPagination meta={meta} onPageChange={(page) => setMeta((prev) => ({ ...prev, page }))} onPageSizeChange={(pageSize) => setMeta((prev) => ({ ...prev, pageSize, page: 1 }))} isSticky={isPaginationSticky} onToggleSticky={() => setIsPaginationSticky(!isPaginationSticky)} />
          </div>
        </div>
      )}

      {isMounted && showWorkflowGuide && <WorkflowGuideModal onClose={() => setShowWorkflowGuide(false)} />}

      <UpdateStatusModal 
        isOpen={showStatusModal} 
        onClose={() => setShowStatusModal(false)} 
        onSuccess={async (status) => { 
          showToast("Se actualizó el estado correctamente", "success"); 
          const nuevosExpedientes = await fetchExpedientes();
          const expedienteActualizado = nuevosExpedientes.find((e: SmartCaseCardData) => e.rawId === drawerData?.caseId);
          if (expedienteActualizado) {
            handleOpenDrawer(expedienteActualizado, status === "OBSERVED" ? "observaciones" : "resumen");
          } else {
            setIsDrawerOpen(false);
          }
        }}
        onError={(msg) => showToast(msg, "error")}
        targetStatus={targetStatus} 
        drawerData={drawerData} 
        currentUser={currentUser} 
      />

      <InspectionDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        data={drawerData}
        renderContent={renderDrawerContent}
        onReevaluate={() => { setTargetStatus("PENDING"); setShowStatusModal(true); }}
        evaluationActions={
          drawerData && !isDrawerLoading ? (
            <>
              <button onClick={() => { setTargetStatus("APPROVED"); setShowStatusModal(true); }} disabled={disableApproveButton} className="flex items-center gap-2 h-9 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:grayscale"><CheckCircle2 size={16} /> Otorgar Conformidad</button>
              <button onClick={() => { setTargetStatus("RESOLVED"); setShowStatusModal(true); }} disabled={disableResolveButton} className="flex items-center gap-2 h-9 px-4 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 text-xs font-bold transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:grayscale"><CheckCircle2 size={16} /> Subsanar</button>
              <button onClick={() => { setTargetStatus("OBSERVED"); setShowStatusModal(true); }} disabled={disableObserveButton} className="flex items-center gap-2 h-9 px-4 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:grayscale"><AlertCircle size={16} /> Observar</button>
              <button onClick={() => { setTargetStatus("REJECTED"); setShowStatusModal(true); }} disabled={disableRejectButton} className="flex items-center gap-2 h-9 px-3 rounded-lg text-red-500 hover:bg-red-50 text-xs font-bold transition-colors ml-auto disabled:opacity-50 disabled:cursor-not-allowed disabled:grayscale"><XCircle size={16} /> Rechazar Definitivo</button>
            </>
          ) : null
        }
      />

      {/* MODAL PARA REEMPLAZAR AVAL */}
      {(() => {
        const approvalsList = drawerData?.payload?.approvals || [];
        const targetApproval = approvalsList.find((a: any) => a.id === replaceAvalTarget?.approvalId) || approvalsList[0];
        const sponsorPerson = targetApproval?.sponsorPerson;

        const oldSponsorName = sponsorPerson 
          ? `${sponsorPerson.firstName || ""} ${sponsorPerson.paternalLastName || ""} ${sponsorPerson.maternalLastName || ""}`.trim() 
          : undefined;
        
        const oldSponsorCode = targetApproval?.sponsorCode || sponsorPerson?.documentNumber || "---";
        const oldSponsorEmail = sponsorPerson?.user?.email || sponsorPerson?.contacts?.find((c: any) => c.email)?.email || sponsorPerson?.email;
        const oldSponsorPhone = sponsorPerson?.contacts?.find((c: any) => c.phoneNumber)?.phoneNumber || sponsorPerson?.phone;
        const oldSponsorStatus = targetApproval?.status;

        return (
          <ReplaceAvalModal 
            isOpen={!!replaceAvalTarget}
            applicationId={replaceAvalTarget?.applicationId || null}
            oldApprovalId={replaceAvalTarget?.approvalId || null}
            oldSponsorName={oldSponsorName}
            oldSponsorCode={oldSponsorCode}
            oldSponsorEmail={oldSponsorEmail}
            oldSponsorPhone={oldSponsorPhone}
            oldSponsorStatus={oldSponsorStatus}
            onClose={() => setReplaceAvalTarget(null)}
            onSuccess={async (msg) => {
              showToast(msg, "success");
              setReplaceAvalTarget(null);
              const nuevosExpedientes = await fetchExpedientes();
              const expedienteActualizado = nuevosExpedientes.find((e: SmartCaseCardData) => e.rawId === drawerData?.caseId);
              if (expedienteActualizado) {
                handleOpenDrawer(expedienteActualizado, "avales");
              }
            }}
            onError={(msg) => showToast(msg, "error")}
          />
        );
      })()}

      {/* MODAL: Reenviar a Aval */}
      {resendAvalTarget && createPortal(
        <div className="fixed inset-0 z-[99999999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[24px] w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 text-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 shadow-sm bg-blue-50 text-blue-600 border border-blue-100">
                <Mail size={32} strokeWidth={2.5} />
              </div>
              <h2 className="text-xl font-black text-slate-800">Reenviar Invitación</h2>
              <p className="text-sm text-slate-500 mt-2.5 font-medium leading-relaxed">
                ¿Deseas volver a enviar el correo de solicitud de respaldo a <strong>{resendAvalTarget.sponsorName}</strong>? <br/><br/>
                Se enviará a: <br/>
                <span className="inline-block mt-2 font-bold text-slate-800 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200 shadow-sm">{resendAvalTarget.sponsorEmail}</span> <br/><br/>
                Se registrará tu nombre y la hora en el historial.
              </p>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => setResendAvalTarget(null)}
                disabled={isResending}
                className="flex-1 py-3 rounded-xl border border-slate-200 bg-white font-bold text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={executeResendEmail}
                disabled={isResending}
                className="flex-1 py-3 rounded-xl font-bold text-white shadow-md transition-colors disabled:opacity-50 bg-blue-600 hover:bg-blue-700"
              >
                {isResending ? "Enviando..." : "Sí, reenviar"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL: Enviar al Comité Evaluador */}
      {notifyComiteTarget && createPortal(
        <div className="fixed inset-0 z-[99999999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[24px] w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 text-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 shadow-sm bg-indigo-50 text-indigo-600 border border-indigo-100">
                <Send size={32} strokeWidth={2.5} className="ml-1" />
              </div>
              <h2 className="text-xl font-black text-slate-800">Notificar al Comité</h2>
              <p className="text-sm text-slate-500 mt-2.5 font-medium leading-relaxed mb-5">
                Se adjuntará automáticamente la Ficha de Postulación y el detalle de las aprobaciones.
              </p>

              <div className="text-left">
                <label className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-2 block ml-1">Enviar notificación a:</label>
                <select 
                  value={selectedComiteMember}
                  onChange={(e) => setSelectedComiteMember(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 text-sm font-semibold text-slate-700 bg-slate-50"
                >
                  <option value="ALL">Enviar a todos los miembros</option>
                  {comiteMembers.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button
                onClick={() => setNotifyComiteTarget(null)}
                disabled={isNotifying}
                className="flex-1 py-3 rounded-xl border border-slate-200 bg-white font-bold text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={executeNotifyComite}
                disabled={isNotifying}
                className="flex-1 py-3 rounded-xl font-bold text-white shadow-md transition-colors disabled:opacity-50 bg-indigo-600 hover:bg-indigo-700"
              >
                {isNotifying ? "Enviando..." : "Sí, notificar"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Toast Notificaciones */}
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