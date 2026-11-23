"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  Archive,
  FileSpreadsheet,
  FileText,
  FolderDown,
  Loader2,
  X,
} from "lucide-react";

interface DownloadAllDocumentsModalProps {
  open: boolean;
  totalResults: number;
  isDownloading: boolean;
  progressLabel: string;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  subjectLabel?: string;
  excelFileName?: string;
}

export function DownloadAllDocumentsModal({
  open,
  totalResults,
  isDownloading,
  progressLabel,
  onClose,
  onConfirm,
  title = "Descargar todos los documentos",
  subjectLabel = "expedientes",
  excelFileName = "Expedientes.xlsx",
}: DownloadAllDocumentsModalProps) {
  const contentItems = [
    {
      icon: FileSpreadsheet,
      title: excelFileName,
      description: `Datos y enlaces de todos los ${subjectLabel} filtrados.`,
    },
    {
      icon: FolderDown,
      title: "documentos/",
      description: `Una carpeta por ${subjectLabel.slice(0, -1)} con los documentos vigentes.`,
    },
    {
      icon: FileText,
      title: "documentos.csv",
      description: "Detalle de cada documento, su fecha y enlace.",
    },
  ] as const;
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isDownloading) onClose();
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, isDownloading, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[999999] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="download-all-documents-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isDownloading) onClose();
      }}
    >
      <div className="w-full max-w-lg overflow-hidden rounded-[28px] bg-white shadow-2xl animate-in zoom-in-95 duration-200">
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#C5A059]/10 text-[#C5A059]">
              <Archive size={19} strokeWidth={2.5} />
            </span>
            <div>
              <h2
                id="download-all-documents-title"
                className="text-lg font-black text-slate-800"
              >
                {title}
              </h2>
              <p className="mt-1 text-xs font-medium text-slate-500">
                Revisa qué incluye el paquete antes de continuar.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isDownloading}
            aria-label="Cerrar"
            className="rounded-full p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <X size={19} strokeWidth={2.5} />
          </button>
        </header>

        <div className="space-y-5 px-6 py-5">
          <p className="text-sm leading-relaxed text-slate-600">
            Se generará un único archivo <strong>ZIP</strong> con los{" "}
            <strong>{totalResults}</strong> {subjectLabel} que coinciden con los
            filtros activos y sus documentos vigentes. Si hay muchos {subjectLabel},
            aplica filtros antes de descargar para que el paquete sea más rápido y
            liviano.
          </p>

          <ul className="space-y-3 text-sm text-slate-700">
            {contentItems.map(({ icon: Icon, title, description }) => (
              <li key={title} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#C5A059]/10 text-[#C5A059]">
                  <Icon size={16} strokeWidth={2.5} />
                </span>
                <span>
                  <strong>{title}</strong> {description}
                </span>
              </li>
            ))}
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                <FileText size={16} strokeWidth={2.5} />
              </span>
              <span>
                <strong>LEEME.txt:</strong> resumen de la generación y contenido del
                paquete.
              </span>
            </li>
          </ul>

          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
            <AlertTriangle size={16} strokeWidth={2.5} className="mt-0.5 shrink-0" />
            <span>
              Si algún archivo ya no está disponible en el almacenamiento, se registrará
              en <strong>_errores.txt</strong> y el resto se descargará con normalidad.
            </span>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isDownloading}
              className="rounded-xl px-4 py-2.5 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isDownloading}
              className="flex items-center justify-center gap-2 rounded-xl bg-[#C5A059] px-5 py-2.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-[#b08a45] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isDownloading ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  {progressLabel}
                </>
              ) : (
                <>
                  <Archive size={15} strokeWidth={2.5} />
                  Descargar ZIP
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
