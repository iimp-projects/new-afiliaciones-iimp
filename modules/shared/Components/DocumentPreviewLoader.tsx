"use client";

import type { ReactNode } from "react";

interface DocumentPreviewLoaderProps {
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
  children: ReactNode;
}

export function DocumentPreviewLoader({ loading, error, onRetry, children }: DocumentPreviewLoaderProps) {
  return (
    <div className="relative h-full w-full">
      <div className={loading || error ? "opacity-30 transition-opacity duration-200" : "animate-in fade-in duration-300"}>
        {children}
      </div>
      {loading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-white/75 text-center" role="status" aria-live="polite">
          <span className="h-7 w-7 animate-spin rounded-full border-2 border-[#C5A059]/25 border-t-[#C5A059]" aria-hidden="true" />
          <span className="text-xs font-bold text-slate-700">Cargando vista previa...</span>
          <span className="text-[10px] text-slate-500">Esto puede tomar unos segundos.</span>
        </div>
      )}
      {error && !loading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-white/90 px-3 text-center" role="status" aria-live="polite">
          <span className="text-xs font-bold text-slate-700">No pudimos cargar la vista previa.</span>
          {onRetry && <button type="button" onClick={onRetry} className="text-[11px] font-bold text-[#9A7739] underline">Reintentar</button>}
        </div>
      )}
    </div>
  );
}
