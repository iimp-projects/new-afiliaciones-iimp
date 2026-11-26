"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { IdCard, X } from "lucide-react";
import { AdminCarnetPanel } from "./AdminCarnetPanel";

export function AdminCarnetDialog({ personId, open, onClose }: { personId: number; open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-carnet-title"
      className="fixed inset-0 z-[1000001] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div className="flex max-h-[90dvh] w-[94vw] max-w-[1060px] flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#ead9b8] bg-[#fbf4e7] text-[#b48a37]"><IdCard size={19} /></span>
            <div>
              <h2 id="admin-carnet-title" className="font-black text-slate-800">Carné virtual</h2>
              <p className="mt-0.5 text-xs font-medium text-slate-500">Consulta y gestiona la credencial institucional del asociado.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6">
          <AdminCarnetPanel personId={personId} variant="split" />
        </div>
      </div>
    </div>,
    document.body,
  );
}
