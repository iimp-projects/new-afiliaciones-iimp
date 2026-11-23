"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, X } from "lucide-react";

interface DocumentPreviewModalProps {
  open: boolean;
  title: string;
  url: string;
  type: string;
  onClose: () => void;
}

export function DocumentPreviewModal({
  open,
  title,
  url,
  type,
  onClose,
}: DocumentPreviewModalProps) {
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, onClose]);

  if (!open || !url) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="document-preview-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
          <h3
            id="document-preview-title"
            className="min-w-0 truncate text-sm font-black text-slate-800"
            title={title}
          >
            {title}
          </h3>
          <div className="flex shrink-0 items-center gap-1">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-bold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <ExternalLink size={15} />
              Abrir
            </a>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar vista previa"
              className="rounded-full p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
            >
              <X size={18} strokeWidth={2.5} />
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-auto bg-slate-50 p-2">
          {type.startsWith("image/") ? (
            <img
              src={url}
              alt={title}
              className="mx-auto max-h-[80vh] w-auto rounded-lg object-contain"
            />
          ) : (
            <iframe
              src={`${url}#toolbar=0&navpanes=0`}
              title={title}
              className="h-[78vh] w-full rounded-lg border-0 bg-white"
            />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
