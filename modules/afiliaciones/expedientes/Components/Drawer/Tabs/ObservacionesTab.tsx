/**
 * ObservacionesTab.tsx
 * Rediseño visual minimalista y normalizado con Documentos/Avales.
 *
 * Cambios visuales:
 * - Menos superficies de color.
 * - Estados comunicados con icono + texto.
 * - Sin banners grandes.
 * - Filtros compactos.
 * - Observaciones en tarjetas blancas, con jerarquía tipográfica.
 * - Adjuntos y acciones con iconos ligeros.
 * - Se conserva la lógica funcional existente.
 */

"use client";

import React, { useState } from "react";
import {
  AlertCircle,
  Ban,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
  FileText,
  History,
  Info,
  MessageSquare,
  ShieldCheck,
  User,
  X,
} from "lucide-react";

interface ObservacionesTabProps {
  payload: any;
  onResolveObservation?: (obsId: number, comment: string) => void;
}

const statusConfig: Record<string, any> = {
  PENDING: {
    label: "Pendiente de subsanación",
    icon: AlertCircle,
    iconClass: "text-amber-500",
  },
  RESOLVED: {
    label: "Observación resuelta",
    icon: CheckCircle2,
    iconClass: "text-emerald-500",
  },
  DISMISSED: {
    label: "Observación desestimada",
    icon: Ban,
    iconClass: "text-slate-400",
  },
};

export function ObservacionesTab({
  payload,
  onResolveObservation,
}: ObservacionesTabProps) {
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [resolveModal, setResolveModal] = useState<{
    isOpen: boolean;
    obsId: number | null;
  }>({ isOpen: false, obsId: null });
  const [resolveComment, setResolveComment] = useState("");

  const observaciones = payload?.observations || [];

  const pendientesCount = observaciones.filter(
    (o: any) => o.status === "PENDING"
  ).length;
  const resueltasCount = observaciones.filter(
    (o: any) => o.status === "RESOLVED"
  ).length;
  const desestimadasCount = observaciones.filter(
    (o: any) => o.status === "DISMISSED"
  ).length;

  const observacionesFiltradas = observaciones.filter((obs: any) => {
    if (filterStatus === "ALL") return true;
    return obs.status === filterStatus;
  });

  const closeResolveModal = () => {
    setResolveModal({ isOpen: false, obsId: null });
    setResolveComment("");
  };

  const handleConfirmResolve = () => {
    if (resolveModal.obsId && onResolveObservation) {
      onResolveObservation(resolveModal.obsId, resolveComment);
    }
    closeResolveModal();
  };

  if (observaciones.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center animate-in fade-in duration-300">
        <ShieldCheck size={32} className="mb-3 text-slate-300" />
        <h3 className="text-sm font-bold text-slate-700">Sin observaciones</h3>
        <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-500">
          Este expediente no registra observaciones en las áreas de revisión.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-8 animate-in fade-in duration-300">
      {/* Resumen compacto */}
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-[13px] font-black uppercase tracking-wide text-slate-800">
              Registro de observaciones
            </h3>
            <p className="mt-0.5 text-[11px] font-medium text-slate-500">
              Estado general de las incidencias del expediente.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px]">
            <span className="font-semibold text-slate-500">
              <strong className="text-slate-700">{observaciones.length}</strong>{" "}
              total
            </span>

            <span className="flex items-center gap-1.5 text-slate-500">
              <AlertCircle size={12} strokeWidth={1.8} className="text-amber-500" />
              <strong className="text-slate-700">{pendientesCount}</strong>
              pendientes
            </span>

            <span className="flex items-center gap-1.5 text-slate-500">
              <CheckCircle2 size={12} strokeWidth={1.8} className="text-emerald-500" />
              <strong className="text-slate-700">{resueltasCount}</strong>
              resueltas
            </span>

            {desestimadasCount > 0 && (
              <span className="flex items-center gap-1.5 text-slate-500">
                <Ban size={12} strokeWidth={1.8} className="text-slate-400" />
                <strong className="text-slate-700">{desestimadasCount}</strong>
                desestimadas
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center">
        <div className="flex w-max items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
          {[
            ["ALL", "Todas"],
            ["PENDING", "Pendientes"],
            ["RESOLVED", "Resueltas"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilterStatus(value)}
              className={`rounded-md px-3 py-1.5 text-[10px] font-semibold transition-colors ${
                filterStatus === value
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-400 hover:text-slate-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de observaciones */}
      <div className="space-y-3">
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
          <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center text-xs font-medium text-slate-400">
            No se encontraron observaciones para el filtro seleccionado.
          </div>
        )}
      </div>

      {/* Modal de subsanación */}
      {resolveModal.isOpen && (
        <div
          className="fixed inset-0 z-[100000] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm animate-in fade-in duration-200"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeResolveModal();
          }}
        >
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h3 className="text-[14px] font-black text-slate-800">
                  Subsanar observación
                </h3>
                <p className="mt-0.5 text-[10px] font-medium text-slate-400">
                  Registra una nota interna de la resolución.
                </p>
              </div>

              <button
                type="button"
                onClick={closeResolveModal}
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700 focus:outline-none"
                title="Cerrar"
                aria-label="Cerrar"
              >
                <X size={17} strokeWidth={1.8} />
              </button>
            </div>

            <div className="px-5 py-4">
              <p className="text-[12px] leading-relaxed text-slate-600">
                ¿Marcar la observación{" "}
                <strong className="text-slate-800">
                  #OBS-{(resolveModal.obsId || 0).toString().padStart(4, "0")}
                </strong>{" "}
                como subsanada?
              </p>

              <div className="relative mt-4">
                <textarea
                  className="h-28 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-[12px] font-medium text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-300 focus:bg-white"
                  placeholder="Nota interna (opcional)..."
                  value={resolveComment}
                  onChange={(e) => setResolveComment(e.target.value)}
                />
                <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                  <MessageSquare size={12} strokeWidth={1.8} />
                  Nota interna
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">
              <button
                type="button"
                onClick={closeResolveModal}
                className="rounded-lg px-3.5 py-2 text-[11px] font-semibold text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700 focus:outline-none"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleConfirmResolve}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3.5 py-2 text-[11px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 focus:outline-none"
              >
                <Check size={14} strokeWidth={2} />
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// TARJETA DE OBSERVACIÓN — MINIMALISTA
// ============================================================================

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

  const currentConfig =
    statusConfig[data.status] || {
      label: data.status || "Estado",
      icon: Clock,
      iconClass: "text-slate-400",
    };

  const StatusIcon = currentConfig.icon;

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Fecha no registrada";

    return new Intl.DateTimeFormat("es-PE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(dateString));
  };

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
      v.department?.code === data.reviewDepartment
  );

  const reviewerName = areaValidation?.validatedBy?.person
    ? `${areaValidation.validatedBy.person.firstName} ${areaValidation.validatedBy.person.paternalLastName}`
    : "Administrador del Sistema";

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Cabecera */}
      <div className="border-b border-slate-100 px-4 py-3.5 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <div className="flex items-center gap-1.5">
                <StatusIcon
                  size={14}
                  strokeWidth={1.8}
                  className={currentConfig.iconClass}
                />
                <span className="text-[10px] font-semibold text-slate-600">
                  {currentConfig.label}
                </span>
              </div>

              <span className="text-[9px] font-medium text-slate-300">•</span>

              <span className="font-mono text-[10px] font-medium text-slate-400">
                #OBS-{data.id.toString().padStart(4, "0")}
              </span>
            </div>

            <div className="mt-2 text-[10px] font-medium uppercase tracking-wider text-slate-400">
              Área revisora:{" "}
              <strong className="text-slate-600">
                {data.reviewDepartment}
              </strong>
            </div>
          </div>

          <div className="flex shrink-0 flex-col gap-1 text-[9px] font-medium text-slate-400 sm:items-end">
            <span className="flex items-center gap-1.5">
              <Clock size={11} strokeWidth={1.8} />
              Creada: {formatDate(data.createdAt)}
            </span>

            <span className="flex items-center gap-1.5">
              <User size={11} strokeWidth={1.8} />
              Revisada por:{" "}
              <strong className="text-slate-600">{reviewerName}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Contenido */}
      <div className="space-y-4 px-4 py-4 sm:px-5">
        {data.status === "RESOLVED" ? (
          <div className="space-y-3">
            <div className="border-l-2 border-slate-200 pl-3">
              <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                Observación original
              </div>
              <div
                className="text-[12px] font-medium leading-relaxed text-slate-600 [&>p]:m-0 [&>ul]:m-0 [&>ul]:pl-4"
                dangerouslySetInnerHTML={createSafeMarkup(
                  data.errorDescription
                )}
              />
            </div>

            <div className="border-l-2 border-emerald-300 pl-3">
              <div className="mb-1 flex items-center justify-between gap-3">
                <span className="text-[10px] font-bold text-slate-600">
                  Resolución del administrador
                </span>

                <span className="flex shrink-0 items-center gap-1 text-[9px] font-medium text-slate-400">
                  <CheckCircle2 size={11} className="text-emerald-500" />
                  {formatDate(data.resolvedAt)}
                </span>
              </div>

              <p className="text-[12px] font-medium leading-relaxed text-slate-600">
                {data.resolutionComment ||
                  "La documentación requerida fue verificada y la observación ha sido marcada como subsanada."}
              </p>
            </div>
          </div>
        ) : (
          <div>
            <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Detalle de la observación
            </div>

            <div
              className="rounded-xl bg-slate-50 px-3.5 py-3 text-[12px] font-medium leading-relaxed text-slate-700 [&>p]:m-0 [&>p]:mb-1 [&>ul]:m-0 [&>ul]:pl-4"
              dangerouslySetInnerHTML={createSafeMarkup(data.errorDescription)}
            />
          </div>
        )}

        {/* Archivo */}
        {data.attachmentUrl && (
          <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <FileText
                size={16}
                strokeWidth={1.7}
                className="shrink-0 text-slate-400"
              />

              <div className="min-w-0">
                <div className="truncate text-[11px] font-semibold text-slate-700">
                  Documento_Adjunto_{data.id}
                </div>
                <div className="text-[9px] font-medium text-slate-400">
                  Proporcionado por el administrador
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleOpenDocument(data.attachmentUrl)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus:outline-none"
              title="Ver archivo"
              aria-label="Ver archivo"
            >
              <Eye size={16} strokeWidth={1.8} />
            </button>
          </div>
        )}
      </div>

      {/* Acciones */}
      <div className="flex flex-col gap-2 border-t border-slate-100 bg-slate-50/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <button
          type="button"
          onClick={() => setShowHistory(!showHistory)}
          className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 transition-colors hover:text-slate-700 focus:outline-none"
        >
          <History size={13} strokeWidth={1.8} />
          {showHistory ? "Ocultar historial" : "Ver historial de resolución"}
          {showHistory ? (
            <ChevronUp size={13} strokeWidth={1.8} />
          ) : (
            <ChevronDown size={13} strokeWidth={1.8} />
          )}
        </button>

        {data.status === "PENDING" && onResolveClick && (
          <button
            type="button"
            onClick={() => onResolveClick(data.id)}
            className="flex items-center justify-center gap-1.5 text-[10px] font-semibold text-emerald-700 transition-colors hover:text-emerald-800 focus:outline-none"
          >
            <CheckCircle2 size={13} strokeWidth={1.8} />
            Subsanar observación
          </button>
        )}
      </div>

      {/* Historial */}
      {showHistory && (
        <div className="border-t border-slate-100 bg-white px-5 py-4">
          <div className="relative space-y-4 pl-4 before:absolute before:inset-y-0 before:left-[5px] before:w-px before:bg-slate-200">
            <div className="relative">
              <span className="absolute -left-[18px] top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-slate-400 ring-1 ring-slate-200" />
              <div className="text-[11px] font-semibold text-slate-700">
                Observación registrada
              </div>
              <div className="mt-0.5 text-[9px] font-medium text-slate-400">
                Por {reviewerName} · {formatDate(data.createdAt)}
              </div>
            </div>

            {data.resolvedAt && (
              <div className="relative">
                <span className="absolute -left-[18px] top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-400 ring-1 ring-emerald-100" />
                <div className="text-[11px] font-semibold text-slate-700">
                  Observación subsanada
                </div>
                <div className="mt-0.5 text-[9px] font-medium text-slate-400">
                  Actualización de sistema · {formatDate(data.resolvedAt)}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
