"use client";

import { Eye, RefreshCw, Trash2 } from "lucide-react";

interface DocumentUploadActionsProps {
  fileName?: string | null;
  canView?: boolean;
  onView: () => void;
  onChange: () => void;
  onRemove: () => void;
  removeLabel?: string;
}

export function DocumentUploadActions({
  fileName,
  canView = true,
  onView,
  onChange,
  onRemove,
  removeLabel = "Eliminar",
}: DocumentUploadActionsProps) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onView}
        disabled={!canView}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Eye size={14} />
        Ver
      </button>
      <button
        type="button"
        onClick={onChange}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50"
      >
        <RefreshCw size={14} />
        Cambiar
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-600 transition-colors hover:bg-red-100"
      >
        <Trash2 size={14} />
        {removeLabel}
      </button>
      {fileName && (
        <span className="min-w-0 truncate text-[11px] text-slate-400" title={fileName}>
          {fileName}
        </span>
      )}
    </div>
  );
}
