"use client";

import { useRef, useState, useEffect } from "react";
import { ChevronDown, Download, FileSpreadsheet, Loader2 } from "lucide-react";
import styles from "./quotasDashboard.module.css";

type ExportType = "summary" | "associates" | "history" | "pending" | "incidences";

const OPTIONS: Array<{ type: ExportType; label: string; description: string }> = [
  { type: "summary", label: "Resumen general", description: "Indicadores, moneda, año y categoría." },
  { type: "associates", label: "Listado de asociados", description: "Resumen económico por asociado." },
  { type: "history", label: "Histórico de cuotas", description: "Registros individuales filtrados." },
  { type: "pending", label: "Cuotas pendientes", description: "Solo cuotas con estado pendiente." },
  { type: "incidences", label: "Incidencias", description: "Vigentes e históricas resueltas." },
];

export function QuotasExportButton({ canExport, searchParams, onNotice }: { canExport: boolean; searchParams: URLSearchParams; onNotice: (message: string) => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<ExportType | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: MouseEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  if (!canExport) return null;

  const download = async (type: ExportType) => {
    setBusy(type);
    setOpen(false);
    try {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("tab");
      params.delete("page");
      params.delete("pageSize");
      params.set("type", type);
      const response = await fetch(`/api/afiliaciones/quotas/export.xlsx?${params.toString()}`);
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        onNotice(response.status === 403 ? "No tienes permiso para exportar cuotas." : body?.message ?? "No se pudo generar la exportación.");
        return;
      }
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const filename = disposition.match(/filename="?([^"]+)"?/)?.[1] ?? `Cuotas_${type}.xlsx`;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      const rows = response.headers.get("X-Export-Rows");
      const truncated = response.headers.get("X-Export-Truncated") === "true";
      onNotice(truncated ? `Exportación generada con ${rows ?? ""} filas. El resultado fue limitado a 50,000 filas; aplica filtros para acotar.` : `Exportación generada correctamente${rows ? ` (${rows} filas)` : ""}.`);
    } catch {
      onNotice("Error de conexión al generar la exportación.");
    } finally {
      setBusy(null);
    }
  };

  return <div ref={ref} className="relative">
    <button type="button" onClick={() => setOpen((value) => !value)} disabled={busy !== null} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[#D4C4B5] bg-white px-4 text-[12px] font-semibold text-[#7F561E] shadow-sm transition-colors hover:border-[#C39254] hover:bg-[#FDFBF8] disabled:opacity-60">
      {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} strokeWidth={2.2} />} Exportar <ChevronDown size={13} />
    </button>
    {open && <div className={`${styles.menuIn} absolute right-0 top-full z-[120] mt-2 w-72 overflow-hidden rounded-2xl border border-[#E4E2E0] bg-white shadow-2xl`}>
      <div className="border-b border-slate-100 bg-slate-50/60 px-4 py-3"><p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Exportación Excel</p><p className="mt-1 text-xs text-slate-500">Respeta los filtros activos. PEN y USD se separan.</p></div>
      {OPTIONS.map((option) => <button key={option.type} type="button" onClick={() => void download(option.type)} disabled={busy !== null} className="flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3 text-left last:border-0 hover:bg-[#fdfaf5] disabled:opacity-60">
        <FileSpreadsheet size={17} className="mt-0.5 shrink-0 text-[#A3722A]" />
        <span><span className="block text-sm font-bold text-slate-700">{option.label}</span><span className="mt-0.5 block text-xs text-slate-500">{option.description}</span></span>
      </button>)}
    </div>}
  </div>;
}
