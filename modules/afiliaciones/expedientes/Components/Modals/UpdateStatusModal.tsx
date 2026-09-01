"use client";
import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { RichTextEditor } from "@/modules/shared/Components/RichTextEditor/RichTextEditor";
import { AlertTriangle, User, GraduationCap, Briefcase, FileText, Users, X, Paperclip, UploadCloud, ChevronDown } from "lucide-react";
import { OBSERVATION_CATEGORIES, applyGeographicDependencies } from "@/modules/afiliaciones/observations/ObservationFields";

interface UpdateStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (targetStatus: string) => void;
  onError: (message: string) => void;
  targetStatus: string;
  drawerData: any;
  currentUser: any;
}

const formatStatusName = (status: string) => {
  const map: Record<string, string> = {
    OBSERVED: "Observado", PENDING: "Pendiente", REJECTED: "Rechazado", APPROVED: "Aprobado", RESOLVED: "Subsanado"
  };
  return map[status] || status;
};

export function UpdateStatusModal({ isOpen, onClose, onSuccess, onError, targetStatus, drawerData, currentUser }: UpdateStatusModalProps) {
  const [statusReason, setStatusReason] = useState("");
  const [targetDepartment, setTargetDepartment] = useState("");
  const [observedFieldPaths, setObservedFieldPaths] = useState<string[]>([]);
  const [activeObservationCategory, setActiveObservationCategory] = useState("personal");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Limpiar el formulario y el área seleccionada cada vez que se abre el modal
  useEffect(() => {
    if (isOpen) {
      setTargetDepartment("");
      setStatusReason("");
      setAttachments([]);
      setObservedFieldPaths([]);
    }
  }, [isOpen, targetStatus]);

  if (!isOpen) return null;

  const isAdmin = currentUser?.role?.slug === "SUPER_ADMIN" || currentUser?.role?.slug === "SYSTEM_ADMIN";

  // =========================================================================
  // MAGIA APLICADA: Filtramos qué áreas puede elegir el Admin según el estado
  // =========================================================================
  const areaValidations = drawerData?.payload?.validations || [];
  const allowedAreas = areaValidations.filter((v: any) => {
    const currentAreaStatus = v.status;
    
    if (targetStatus === "RESOLVED") {
      // Para "Subsanar", el área en la BD DEBE estar en "OBSERVED"
      return currentAreaStatus === "OBSERVED";
    }
    if (targetStatus === "OBSERVED") {
      // Para "Observar", el área no debe estar cerrada
      return currentAreaStatus !== "APPROVED" && currentAreaStatus !== "REJECTED";
    }
    if (targetStatus === "APPROVED" || targetStatus === "REJECTED") {
      // Para "Aprobar/Rechazar", el área no debe estar cerrada ya
      return currentAreaStatus !== "APPROVED" && currentAreaStatus !== "REJECTED";
    }
    return true; // Para "PENDING" (Reevaluar) permitimos todas
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setAttachments((prev) => [...prev, ...Array.from(e.target.files!)]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (idxToRemove: number) => setAttachments((prev) => prev.filter((_, i) => i !== idxToRemove));

  const confirmStatusChange = async () => {
    if (!drawerData) return;
    if (statusReason === "<p></p>" || statusReason.trim() === "") return onError("Debe ingresar un motivo");
    if (isAdmin && !targetDepartment) return onError("Debe seleccionar el área en representación");

    setIsUpdatingStatus(true);
    try {
      let uploadedUrl = null;
      if (attachments.length > 0) {
        const formData = new FormData();
        formData.append("file", attachments[0]);
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
          targetDepartmentCode: targetDepartment || undefined, 
        }),
      });
      const data = await res.json();

      if (data.success) {
        onSuccess(targetStatus);
        onClose();
      } else {
        onError(data.message);
      }
    } catch (error) {
      onError("Error de conexión al actualizar estado.");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const isModalApplicantStudent = drawerData?.payload?.affiliateType === "STUDENT" || drawerData?.header?.identity?.categoryBadge?.label?.toUpperCase().includes("ESTUDIANTE");
  const activeCategories = OBSERVATION_CATEGORIES.map((cat) => ({ ...cat, fields: cat.fields.filter((f) => !f.studentOnly || isModalApplicantStudent) })).filter((cat) => cat.fields.length > 0);
  const currentCategory = activeCategories.find((c) => c.id === activeObservationCategory) || activeCategories[0];
  const allCurrentSelected = currentCategory.fields.every((f) => observedFieldPaths.includes(f.key));

  return createPortal(
    <div className="fixed inset-0 z-[9999999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh]">
        
        {/* Cabecera con el título arreglado */}
        <div className="p-6 text-center border-b border-gray-100 bg-gray-50/50 shrink-0">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border ${targetStatus === "REJECTED" ? "bg-red-50 text-red-600 border-red-200" : "bg-amber-100 text-amber-600 border-amber-200"}`}>
            <AlertTriangle size={28} />
          </div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight">
            {targetStatus === "OBSERVED" ? "¿Observar Expediente?" : 
             targetStatus === "PENDING" ? "¿Reevaluar Expediente?" : 
             targetStatus === "REJECTED" ? "⚠ ¿Rechazar Definitivamente?" : 
             targetStatus === "RESOLVED" ? "¿Subsanar Observación?" : 
             "¿Otorgar Conformidad?"}
          </h2>
          <p className="text-sm text-slate-500 mt-2 leading-relaxed px-4">
            Está a punto de cambiar el estado a <strong className="text-slate-800 uppercase">{formatStatusName(targetStatus)}</strong>.
          </p>
        </div>

        {/* Cuerpo del Formulario */}
        <div className="p-6 space-y-5 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 flex-1">
          
          {/* SELECTOR SUPER ADMIN DINÁMICO */}
          {isAdmin && (
            <div className="p-4 bg-[#FFFDF8] border border-[#E8D09E] rounded-xl shadow-sm">
              <label className="block text-xs font-black text-[#7f561e] uppercase tracking-widest mb-2">¿A nombre de qué área estás evaluando? <span className="text-red-500">*</span></label>
              
              {allowedAreas.length === 0 ? (
                <div className="text-red-600 bg-red-50 px-3 py-2 rounded-lg text-xs font-bold border border-red-100">
                  Ninguna área es elegible para esta acción en su estado actual.
                </div>
              ) : (
                <div className="relative">
                  <select value={targetDepartment} onChange={(e) => setTargetDepartment(e.target.value)} className="w-full h-11 px-4 rounded-lg border border-[#E8D09E] bg-white text-slate-700 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#C5A059]/20 appearance-none cursor-pointer">
                    <option value="">Selecciona el área a representar...</option>
                    {allowedAreas.map((v: any) => (
                      <option key={v.department.code} value={v.department.code}>
                        {v.department.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#C5A059] pointer-events-none" />
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2 ml-1">Motivo o Comentario <span className="text-red-500">*</span></label>
            <RichTextEditor value={statusReason} onChange={setStatusReason} placeholder="Describa el motivo..." />
          </div>

          {/* LÓGICA DE OBSERVACIONES */}
          {targetStatus === "OBSERVED" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide ml-1">Campos a corregir <span className="text-red-500">*</span></label>
              </div>
              <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
                {activeCategories.map((cat) => {
                  const count = cat.fields.filter((f) => observedFieldPaths.includes(f.key)).length;
                  const isActive = currentCategory.id === cat.id;
                  const CatIcon = cat.id === "personal" ? User : cat.id === "academic" ? GraduationCap : cat.id === "employment" ? Briefcase : cat.id === "documents" ? FileText : Users;
                  return (
                    <button key={cat.id} type="button" onClick={() => setActiveObservationCategory(cat.id)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${isActive ? "bg-white text-slate-900 shadow-sm border border-slate-200" : "text-slate-600 hover:text-slate-900 hover:bg-white/60"}`}>
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
                  <button type="button" onClick={() => {
                    let updated = [...observedFieldPaths];
                    currentCategory.fields.forEach((f) => { updated = applyGeographicDependencies(updated, f.key, !allCurrentSelected); });
                    setObservedFieldPaths(updated);
                  }} className="text-[11px] font-bold text-[#c39254] hover:text-[#7f561e] transition-colors">
                    {allCurrentSelected ? "Deseleccionar todos" : "Seleccionar todos"}
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pr-1">
                  {currentCategory.fields.map((field) => {
                    const checked = observedFieldPaths.includes(field.key);
                    return (
                      <label key={field.key} className={`flex items-center gap-2 p-2 rounded-lg text-xs font-medium cursor-pointer transition-all border ${checked ? "bg-amber-50/80 border-amber-300 text-amber-900 font-semibold" : "bg-white border-slate-200/80 text-slate-700 hover:border-slate-300 hover:bg-slate-50/60"}`}>
                        <input type="checkbox" checked={checked} onChange={() => setObservedFieldPaths((current) => applyGeographicDependencies(current, field.key, !checked))} className="accent-[#c39254] rounded w-3.5 h-3.5" />
                        <span className="truncate">{field.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              {observedFieldPaths.length === 0 && <p className="text-[11px] text-amber-700 font-medium ml-1">⚠️ Seleccione al menos un campo a corregir.</p>}
            </div>
          )}

          {/* Adjuntos */}
          <div>
            <div className="flex items-center justify-between mb-2 ml-1 pr-1">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Evidencia Adjunta <span className="text-gray-400 font-normal normal-case">(Opcional)</span></label>
              <button type="button" onClick={() => fileInputRef.current?.click()} className="text-xs font-bold text-[#c39254] flex items-center gap-1 hover:text-[#7f561e] transition-colors bg-[#c39254]/10 px-2 py-1 rounded-md"><Paperclip size={14} /> Añadir</button>
              <input type="file" multiple className="hidden" ref={fileInputRef} onChange={handleFileChange} />
            </div>
            {attachments.length > 0 ? (
              <ul className="space-y-2">
                {attachments.map((file, idx) => (
                  <li key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 border border-gray-200 group hover:border-[#c39254]/50 transition-colors">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center shrink-0"><FileText size={16} className="text-slate-400" /></div>
                      <div className="flex flex-col truncate">
                        <span className="text-sm font-bold text-slate-700 truncate">{file.name}</span>
                        <span className="text-[10px] text-slate-400 font-medium">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                      </div>
                    </div>
                    <button onClick={() => removeFile(idx)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors shrink-0"><X size={16} strokeWidth={2.5} /></button>
                  </li>
                ))}
              </ul>
            ) : (
              <div onClick={() => fileInputRef.current?.click()} className="w-full py-5 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center text-slate-400 hover:border-[#c39254] hover:bg-[#c39254]/5 hover:text-[#c39254] transition-all cursor-pointer">
                <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center mb-2"><UploadCloud size={20} /></div>
                <span className="text-sm font-bold">Clic para adjuntar archivos</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 pt-4 border-t border-gray-100 flex gap-3 shrink-0 bg-white">
          <button onClick={onClose} className="flex-1 py-3.5 rounded-xl border-2 border-gray-200 text-slate-600 font-bold text-sm hover:bg-gray-50 transition-colors">Cancelar</button>
          
          <button 
            onClick={confirmStatusChange} 
            disabled={
              isUpdatingStatus || 
              statusReason === "<p></p>" || 
              statusReason.trim() === "" || 
              (targetStatus === "OBSERVED" && observedFieldPaths.length === 0) ||
              (isAdmin && !targetDepartment) // <--- Deshabilita si no escoge el dropdown
            } 
            className={`flex-1 py-3.5 rounded-xl text-white font-black tracking-wide text-sm shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all ${targetStatus === "OBSERVED" ? "bg-amber-500 hover:bg-amber-600" : targetStatus === "REJECTED" ? "bg-red-600 hover:bg-red-700" : "bg-[#c39254] hover:bg-[#a3722a]"}`}
          >
            {isUpdatingStatus ? "Actualizando..." : "Sí, confirmar"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}