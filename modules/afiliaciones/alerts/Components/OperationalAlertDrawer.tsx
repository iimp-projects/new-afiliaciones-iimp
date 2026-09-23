"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";

type Props = { open: boolean; title: string; children: ReactNode; onClose: () => void };

// InspectionDrawer is deliberately not used: its header, history and payload contracts are expediente-specific.
export function OperationalAlertDrawer({ open, title, children, onClose }: Props) {
  if (!open) return null;
  return <div className="fixed inset-0 z-50"><button aria-label="Cerrar detalle" onClick={onClose} className="absolute inset-0 bg-slate-950/45" /><aside role="dialog" aria-modal="true" aria-label={title} className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col bg-white shadow-2xl"><header className="flex items-center justify-between border-b border-slate-100 px-6 py-5"><h2 className="text-lg font-black text-slate-800">{title}</h2><button aria-label="Cerrar" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={18} /></button></header><div className="flex-1 overflow-y-auto p-6">{children}</div></aside></div>;
}
