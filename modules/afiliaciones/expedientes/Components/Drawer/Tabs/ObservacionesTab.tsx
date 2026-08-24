"use client";

import React, { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
  Eye,
  History,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Ban,
  User,
  X,
  MessageSquare,
} from "lucide-react";

interface ObservacionesTabProps {
  payload: any;
  onResolveObservation?: (obsId: number, comment: string) => void;
}

export function ObservacionesTab({
  payload,
  onResolveObservation,
}: ObservacionesTabProps) {
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [resolveModal, setResolveModal] = useState<{
    isOpen: boolean;
    obsId: number | null;
  }>({ isOpen: false, obsId: null });
  const [resolveComment, setResolveComment] = useState("");

  const observaciones = payload?.observations || [];

  const pendientesCount = observaciones.filter(
    (o: any) => o.status === "PENDING",
  ).length;
  const resueltasCount = observaciones.filter(
    (o: any) => o.status === "RESOLVED",
  ).length;
  const desestimadasCount = observaciones.filter(
    (o: any) => o.status === "DISMISSED",
  ).length;

  const observacionesFiltradas = observaciones.filter((obs: any) => {
    if (filterStatus === "ALL") return true;
    return obs.status === filterStatus;
  });

  const handleConfirmResolve = () => {
    if (resolveModal.obsId && onResolveObservation) {
      onResolveObservation(resolveModal.obsId, resolveComment);
    }
    setResolveModal({ isOpen: false, obsId: null });
    setResolveComment("");
  };

  if (observaciones.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-2xl border border-slate-200 border-dashed animate-in fade-in duration-300">
        <ShieldCheck size={40} className="text-slate-300 mb-3" />
        <h3 className="text-lg font-bold text-slate-700">Sin observaciones</h3>
        <p className="text-sm text-slate-500 mt-1 max-w-sm">
          Este expediente no registra ninguna observación u observación
          histórica en las áreas de revisión.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300 pb-10 relative">
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-[13px] font-black text-slate-800 uppercase tracking-wide">
            Registro de Observaciones
          </h3>
          <p className="text-[11px] font-medium text-slate-500 mt-0.5">
            Estado general de las incidencias del expediente.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertCircle size={14} className="text-amber-600" />
            <span className="text-[11px] font-bold text-amber-800">
              {pendientesCount} Pendientes
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg">
            <CheckCircle2 size={14} className="text-emerald-600" />
            <span className="text-[11px] font-bold text-emerald-800">
              {resueltasCount} Resueltas
            </span>
          </div>
          {desestimadasCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg">
              <Ban size={14} className="text-slate-500" />
              <span className="text-[11px] font-bold text-slate-700">
                {desestimadasCount} Desestimadas
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 bg-slate-100/50 p-1 rounded-xl border border-slate-200 w-max">
          <button
            onClick={() => setFilterStatus("ALL")}
            className={`px-4 py-1.5 text-[11px] font-bold rounded-lg transition-all ${filterStatus === "ALL" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            Todas
          </button>
          <button
            onClick={() => setFilterStatus("PENDING")}
            className={`px-4 py-1.5 text-[11px] font-bold rounded-lg transition-all ${filterStatus === "PENDING" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            Pendientes
          </button>
          <button
            onClick={() => setFilterStatus("RESOLVED")}
            className={`px-4 py-1.5 text-[11px] font-bold rounded-lg transition-all ${filterStatus === "RESOLVED" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            Resueltas
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {observacionesFiltradas.length > 0 ? (
          observacionesFiltradas.map((obs: any) => (
            <ObservationCard
              key={obs.id}
              data={obs}
              payload={payload}
              onResolveClick={(id) =>
                setResolveModal({ isOpen: true, obsId: id })
              }
            />
          ))
        ) : (
          <div className="text-center p-8 text-slate-400 text-sm font-medium">
            No se encontraron observaciones para el filtro seleccionado.
          </div>
        )}
      </div>

      {/* MODAL DE SUBSANACIÓN INDIVIDUAL */}
      {resolveModal.isOpen && (
        <div className="fixed inset-0 z-[100000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-emerald-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                  <CheckCircle2 size={20} strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-[16px]">
                    Subsanar Observación
                  </h3>
                  <span className="text-[11px] font-bold text-slate-500">
                    Se notificará al sistema la resolución
                  </span>
                </div>
              </div>
              <button
                onClick={() => setResolveModal({ isOpen: false, obsId: null })}
                className="text-slate-400 hover:text-slate-700 transition-colors p-1 bg-white rounded-full shadow-sm border border-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 bg-[#fdfdfd]">
              <p className="text-[13px] text-slate-600 mb-4 font-medium leading-relaxed">
                ¿Estás seguro de marcar la observación{" "}
                <strong>
                  #OBS-{(resolveModal.obsId || 0).toString().padStart(4, "0")}
                </strong>{" "}
                como subsanada? Puedes agregar una nota interna sobre el motivo
                de esta resolución.
              </p>

              <div className="relative">
                <textarea
                  className="w-full h-28 p-4 pt-4 pb-10 bg-white border border-slate-200 rounded-xl text-[13px] text-slate-700 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 resize-none transition-all placeholder:text-slate-400 shadow-sm"
                  placeholder="Ej. El usuario presentó la evidencia solicitada vía correo..."
                  value={resolveComment}
                  onChange={(e) => setResolveComment(e.target.value)}
                ></textarea>
                <div className="absolute bottom-3 left-4 flex items-center gap-1.5 text-slate-400">
                  <MessageSquare size={14} />
                  <span className="text-[10px] font-bold uppercase tracking-widest">
                    Nota Interna (Opcional)
                  </span>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button
                onClick={() => setResolveModal({ isOpen: false, obsId: null })}
                className="px-5 py-2.5 text-[12px] font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors focus:outline-none"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmResolve}
                className="px-5 py-2.5 text-[13px] font-bold bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl shadow-md shadow-emerald-500/20 transition-all flex items-center gap-2 hover:-translate-y-0.5 focus:outline-none"
              >
                Confirmar Subsanación
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==============================================================
// SUB-COMPONENTE: TARJETA DE OBSERVACIÓN
// ==============================================================

function ObservationCard({
  data,
  payload,
  onResolveClick,
}: {
  data: any;
  payload: any;
  onResolveClick?: (id: number) => void;
}) {
  const [showHistory, setShowHistory] = useState(false);

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "PENDING":
        return {
          label: "Pendiente de Subsanación",
          icon: AlertCircle,
          badgeClass: "bg-amber-50 text-amber-700 border-amber-200",
          borderClass: "border-l-amber-500",
        };
      case "RESOLVED":
        return {
          label: "Observación Resuelta",
          icon: CheckCircle2,
          badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
          borderClass: "border-l-emerald-500",
        };
      case "DISMISSED":
        return {
          label: "Observación Desestimada",
          icon: Ban,
          badgeClass: "bg-slate-50 text-slate-600 border-slate-200",
          borderClass: "border-l-slate-400",
        };
      default:
        return {
          label: status,
          icon: Clock,
          badgeClass: "bg-gray-50 text-gray-600 border-gray-200",
          borderClass: "border-l-gray-400",
        };
    }
  };

  const currentConfig = getStatusConfig(data.status);
  const StatusIcon = currentConfig.icon;

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Fecha no registrada";
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("es-PE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  };

  // Función segura para renderizar el HTML del tipTap Editor
  const createSafeMarkup = (htmlString: string) => {
    if (!htmlString) return { __html: "" };
    const decoded = htmlString
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");
    return { __html: decoded };
  };

  const handleOpenDocument = (url: string) => {
    window.open(url, "_blank");
  };

  const areaValidation = payload?.validations?.find(
    (v: any) =>
      v.department?.name === data.reviewDepartment ||
      v.department?.code === data.reviewDepartment,
  );
  const reviewerName = areaValidation?.validatedBy?.person
    ? `${areaValidation.validatedBy.person.firstName} ${areaValidation.validatedBy.person.paternalLastName}`
    : "Administrador del Sistema";

  return (
    <div
      className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden border-l-4 ${currentConfig.borderClass} transition-all`}
    >
      <div className="p-5 pb-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[10px] font-black uppercase tracking-widest ${currentConfig.badgeClass}`}
            >
              <StatusIcon size={12} strokeWidth={3} />
              {currentConfig.label}
            </span>
            <span className="text-[11px] font-bold text-slate-400 font-mono bg-slate-100 px-2 py-1 rounded-md">
              #OBS-{data.id.toString().padStart(4, "0")}
            </span>
          </div>
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mt-1 flex items-center gap-1">
            Área Revisora:{" "}
            <strong className="text-slate-700">{data.reviewDepartment}</strong>
          </span>
        </div>
        <div className="text-[11px] font-medium text-slate-400 flex flex-col sm:items-end gap-1 sm:self-start">
          <span className="flex items-center gap-1.5">
            <Clock size={12} /> Creada: {formatDate(data.createdAt)}
          </span>
          <span className="flex items-center gap-1.5">
            <User size={12} /> Revisada por:{" "}
            <strong className="text-slate-600">{reviewerName}</strong>
          </span>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* DISEÑO ESTILO WHATSAPP REPLY (AHORA LEYENDO DIRECTAMENTE DE LA BD) */}
        {data.status === "RESOLVED" ? (
          <div className="flex flex-col gap-3">
            <div className="pl-4 py-2 border-l-[3px] border-[#C5A059] bg-[#fdfaf5] rounded-r-xl">
              <span className="text-[10px] font-black text-[#C5A059] uppercase tracking-widest block mb-1">
                Observación Original
              </span>
              <div
                className="text-[13px] font-medium text-slate-600 leading-snug [&>p]:m-0 [&>p]:inline"
                dangerouslySetInnerHTML={createSafeMarkup(
                  data.errorDescription,
                )}
              />
            </div>

            {/* BURBUJA DE COMENTARIO DESDE LA BD */}
            <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl rounded-tl-none relative w-full sm:w-[90%] shadow-sm ml-6">
              <div className="flex justify-between items-start gap-4 mb-2">
                <span className="text-[12px] font-black text-emerald-800">
                  Resolución del Administrador
                </span>
                <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1 shrink-0">
                  <CheckCircle2 size={12} /> {formatDate(data.resolvedAt)}
                </span>
              </div>
              <p className="text-[14px] text-emerald-900 font-medium leading-relaxed">
                {data.resolutionComment ||
                  "La documentación requerida fue verificada y la observación ha sido marcada como subsanada."}
              </p>
            </div>
          </div>
        ) : (
          <div>
            <h4 className="text-[13px] font-black text-slate-400 uppercase tracking-widest mb-2">
              Detalle de la Observación
            </h4>
            <div
              className="text-[14px] font-medium text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100 [&>p]:m-0 [&>p]:mb-1 [&>ul]:m-0 [&>ul]:pl-4"
              dangerouslySetInnerHTML={createSafeMarkup(data.errorDescription)}
            />
          </div>
        )}

        {/* Archivo adjunto */}
        {data.attachmentUrl && (
          <div>
            <span className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2">
              Archivo de referencia
            </span>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl border border-slate-200 bg-white shadow-sm gap-4 hover:border-[#C5A059] transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 text-[#C5A059]">
                  <FileText size={20} />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[12px] font-bold text-slate-800 truncate">
                    Documento_Adjunto_{data.id}
                  </span>
                  <span className="text-[10px] font-medium text-slate-400 mt-0.5">
                    Proporcionado por el administrador
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleOpenDocument(data.attachmentUrl)}
                  className="px-3 py-1.5 text-slate-600 hover:text-[#C5A059] bg-white border border-slate-200 hover:border-[#C5A059] rounded-lg transition-colors shadow-sm text-xs font-bold flex items-center gap-1.5"
                >
                  <Eye size={14} /> Ver archivo
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-4">
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="text-[11px] font-bold text-slate-500 hover:text-[#C5A059] flex items-center gap-1.5 transition-colors focus:outline-none"
        >
          <History size={14} />{" "}
          {showHistory ? "Ocultar historial" : "Ver historial de resolución"}
          {showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
          {data.status === "PENDING" && onResolveClick && (
            <button
              onClick={() => onResolveClick(data.id)}
              className="px-4 py-2 bg-emerald-50 text-emerald-700 text-[11px] font-bold rounded-lg hover:bg-emerald-100 border border-emerald-200 transition-all shadow-sm flex items-center gap-1.5 focus:outline-none"
            >
              <CheckCircle2 size={14} /> Subsanar Observación
            </button>
          )}
        </div>
      </div>

      {showHistory && (
        <div className="p-5 pt-2 border-t border-slate-100 bg-[#fdfdfd] animate-in slide-in-from-top-2 duration-200">
          <div className="relative pl-4 space-y-5 before:absolute before:inset-y-0 before:left-[7px] before:w-[2px] before:bg-slate-100">
            <div className="relative flex items-start gap-4">
              <div className="absolute -left-[20px] top-1 w-3 h-3 rounded-full bg-white border-2 border-amber-500 z-10"></div>
              <div className="flex flex-col w-full">
                <span className="text-[12px] font-bold text-slate-800">
                  Observación Registrada
                </span>
                <div className="flex items-center gap-2 mt-0.5 mb-2">
                  <span className="text-[10px] font-semibold text-slate-600">
                    Por {reviewerName}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    • {formatDate(data.createdAt)}
                  </span>
                </div>
              </div>
            </div>
            {data.resolvedAt && (
              <div className="relative flex items-start gap-4">
                <div className="absolute -left-[20px] top-1 w-3 h-3 rounded-full bg-white border-2 border-emerald-500 z-10"></div>
                <div className="flex flex-col w-full">
                  <span className="text-[12px] font-bold text-slate-800">
                    Observación Subsanada
                  </span>
                  <div className="flex items-center gap-2 mt-0.5 mb-2">
                    <span className="text-[10px] font-semibold text-slate-600">
                      Actualización de sistema
                    </span>
                    <span className="text-[10px] text-slate-400">
                      • {formatDate(data.resolvedAt)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
