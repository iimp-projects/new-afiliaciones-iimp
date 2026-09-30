"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, ArrowLeft, Check, CheckCircle2, FileSpreadsheet, RefreshCw, Search, Trash2, X } from "lucide-react";
import { processRecipientsExcelAction, confirmRecipientsImportAction } from "../Actions/recipientImport.actions";
import { ProcessLoadingOverlay } from "@/modules/shared/Components/ProcessLoadingOverlay";
import type { ImportConfirmInput, ImportPreview, ImportResult } from "../Models/RecipientImport";

const subscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

type Step = "select" | "review" | "result";
type PreviewFilter = "all" | "valid" | "invalid" | "duplicate" | "existing";

const statusBadge: Record<string, { label: string; className: string }> = {
  VALID: { label: "Válido", className: "bg-emerald-100 text-emerald-700" },
  INVALID: { label: "Inválido", className: "bg-red-100 text-red-700" },
  DUPLICATE_FILE: { label: "Duplicado", className: "bg-amber-100 text-amber-700" },
  ALREADY_EXISTS: { label: "Existente", className: "bg-blue-100 text-blue-700" },
};

const steps: Array<{ key: Step; label: string }> = [
  { key: "select", label: "Archivo" },
  { key: "review", label: "Revisión" },
  { key: "result", label: "Resultado" },
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ImportRecipientsWizard({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [step, setStep] = useState<Step>("select");
  const [processing, setProcessing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [listNames, setListNames] = useState<Record<string, string>>({});
  const [emailColumns, setEmailColumns] = useState<Record<string, string>>({});
  const [previewFilter, setPreviewFilter] = useState<PreviewFilter>("all");
  const [previewSheet, setPreviewSheet] = useState<string>("all");
  const [search, setSearch] = useState("");

  const busy = processing || importing;
  const mounted = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);

  useEffect(() => {
    const bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = bodyOverflow;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [busy, onClose]);

  const handleFileSelected = (file: File) => {
    setError(null);
    setSelectedFile(file);
    setPreview(null);
    setResult(null);
  };

  const clearFile = () => {
    setError(null);
    setSelectedFile(null);
  };

  const handleProcess = async () => {
    if (!selectedFile || busy) return;
    setError(null);
    setProcessing(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      const response = await processRecipientsExcelAction(formData);
      if (!response.success) {
        setError(response.message);
        return;
      }
      setPreview(response.preview);
      const names: Record<string, string> = {};
      const columns: Record<string, string> = {};
      for (const sheet of response.preview.sheets) {
        names[sheet.sheetName] = sheet.listName;
        columns[sheet.sheetName] = sheet.mapping?.email ?? "";
      }
      setListNames(names);
      setEmailColumns(columns);
      setStep("review");
    } catch {
      setError("No se pudo procesar el archivo.");
    } finally {
      setProcessing(false);
    }
  };

  const requiresConfig = useMemo(
    () => (preview ? preview.sheets.filter((sheet) => !sheet.mapping && !emailColumns[sheet.sheetName]).length > 0 : false),
    [preview, emailColumns],
  );

  const filteredRows = useMemo(() => {
    if (!preview) return [];
    return preview.sheets.flatMap((sheet) => {
      if (previewSheet !== "all" && sheet.sheetName !== previewSheet) return [];
      const mapping = sheet.mapping ?? (emailColumns[sheet.sheetName] ? { email: emailColumns[sheet.sheetName] } : null);
      if (!mapping) return [];
      return sheet.rows.filter((row) => {
        if (previewFilter === "valid" && row.status !== "VALID") return false;
        if (previewFilter === "invalid" && row.status !== "INVALID") return false;
        if (previewFilter === "duplicate" && row.status !== "DUPLICATE_FILE") return false;
        if (previewFilter === "existing" && row.status !== "ALREADY_EXISTS") return false;
        if (search) {
          const haystack = `${row.name ?? ""} ${row.company ?? ""} ${row.email}`.toLowerCase();
          if (!haystack.includes(search.toLowerCase())) return false;
        }
        return true;
      });
    });
  }, [preview, previewSheet, previewFilter, search, emailColumns]);

  const handleConfirm = async () => {
    if (!preview || busy) return;
    setError(null);
    setImporting(true);
    try {
      const input: ImportConfirmInput = {
        fileName: preview.fileName,
        sheets: preview.sheets.map((sheet) => {
          const mapping = sheet.mapping ?? { email: emailColumns[sheet.sheetName] ?? "" };
          return {
            sheetName: sheet.sheetName,
            listName: (listNames[sheet.sheetName] || sheet.sheetName).trim() || sheet.sheetName,
            mapping,
            rows: sheet.sourceRows,
          };
        }),
      };
      const response = await confirmRecipientsImportAction(input);
      if (!response.success) {
        setError(response.message);
        setStep("review");
        return;
      }
      setResult(response.result);
      setStep("result");
    } catch {
      setError("No se pudo confirmar la importación.");
      setStep("review");
    } finally {
      setImporting(false);
    }
  };

  const stats: Array<[string, number, string]> = preview
    ? [
        ["Encontrados", preview.totals.found, "text-slate-800"],
        ["Únicos", preview.totals.unique, "text-slate-800"],
        ["Válidos", preview.totals.valid, "text-emerald-600"],
        ["Inválidos", preview.totals.invalid, "text-red-600"],
        ["Duplicados", preview.totals.duplicate, "text-amber-600"],
        ["Existentes", preview.totals.existing, "text-blue-600"],
      ]
    : [];

  const stepIndex = step === "select" ? 0 : step === "review" ? 1 : 2;
  const loadingTitle = importing ? "Importando destinatarios..." : "Procesando archivo...";
  const loadingDescription = importing
    ? "Estamos registrando los contactos y sus listas. No cierres esta ventana."
    : "Estamos revisando las hojas y validando los destinatarios. Esto puede tomar unos segundos.";

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-recipients-title"
        aria-describedby="import-recipients-desc"
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-[24px] bg-white shadow-2xl"
      >
        <header className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-slate-50/50 px-8 py-6">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#C5A059]">Correos Masivos</p>
            <h2 id="import-recipients-title" className="mt-1 text-xl font-black text-slate-800">Importar destinatarios</h2>
            <p id="import-recipients-desc" className="mt-1 text-xs text-slate-500">Importa y revisa los contactos antes de agregarlos.</p>
          </div>
          <button onClick={onClose} disabled={busy} aria-label="Cerrar" className="rounded-full p-2 text-slate-400 hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40">
            <X size={22} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-8" aria-busy={busy}>
          <nav className="mb-6 flex items-center gap-3" aria-label="Progreso de importación">
            {steps.map((item, index) => {
              const isActive = index === stepIndex;
              const isDone = index < stepIndex;
              return (
                <div key={item.key} className="flex items-center gap-3">
                  <div className={`flex items-center gap-1.5 ${isActive ? "text-[#C5A059]" : isDone ? "text-emerald-700" : "text-slate-400"}`}>
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black ${isActive ? "bg-[#C5A059] text-white" : isDone ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      {isDone ? <Check size={13} /> : index + 1}
                    </span>
                    <span className="text-xs font-bold">{item.label}</span>
                  </div>
                  {index < steps.length - 1 && <span aria-hidden="true" className={`h-px w-8 ${index < stepIndex ? "bg-emerald-300" : "bg-slate-200"}`} />}
                </div>
              );
            })}
          </nav>

          <div aria-live="polite">
            {error && (
              <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700" role="alert">
                <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                {error}
              </div>
            )}
          </div>

          {step === "select" && !selectedFile && (
            <label
              className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-12 text-center transition-colors focus-within:border-[#C5A059] ${
                dragOver ? "border-[#C5A059] bg-[#fdfaf5]" : "border-slate-300 hover:border-[#C5A059] hover:bg-[#fdfaf5]"
              } ${busy ? "cursor-not-allowed opacity-60" : ""}`}
              onDragOver={(event) => {
                event.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragOver(false);
                const file = event.dataTransfer.files?.[0];
                if (file) handleFileSelected(file);
              }}
            >
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#C5A059]/10">
                <FileSpreadsheet size={32} className="text-[#C5A059]" />
              </span>
              <span className="text-base font-black text-slate-800">Selecciona un archivo Excel</span>
              <span className="text-sm text-slate-500">Arrastra tu archivo aquí o haz clic para seleccionarlo</span>
              <span className="text-xs font-semibold text-slate-400">.xlsx · máximo 5 MB</span>
              <input
                type="file"
                accept=".xlsx"
                disabled={busy}
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) handleFileSelected(file);
                }}
              />
            </label>
          )}

          {step === "select" && selectedFile && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="flex items-start gap-4">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[#C5A059]/30 bg-[#fdfaf5]">
                  <FileSpreadsheet size={28} className="text-[#C5A059]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-black text-slate-800" title={selectedFile.name}>{selectedFile.name}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">Archivo Excel · {formatFileSize(selectedFile.size)}</p>
                  <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                    <CheckCircle2 size={14} /> Archivo listo para revisar
                  </p>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 transition-colors hover:border-[#C5A059] hover:text-[#C5A059] focus-within:ring-2 focus-within:ring-[#C5A059]/40">
                  <RefreshCw size={15} /> Cambiar archivo
                  <input
                    type="file"
                    accept=".xlsx"
                    disabled={busy}
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) handleFileSelected(file);
                    }}
                  />
                </label>
                <button type="button" onClick={clearFile} disabled={busy} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50">
                  <Trash2 size={15} /> Quitar
                </button>
              </div>
            </div>
          )}

          {step === "review" && preview && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                <FileSpreadsheet size={16} className="shrink-0 text-[#C5A059]" />
                <span className="truncate">Archivo: <strong>{preview.fileName}</strong></span>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-6">
                {stats.map(([label, value, color]) => (
                  <div key={label} className="rounded-2xl border border-slate-200 bg-white p-3 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
                    <p className={`mt-1 text-2xl font-black ${color}`}>{value}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                {preview.sheets.map((sheet) => {
                  const needsEmail = !sheet.mapping && !emailColumns[sheet.sheetName];
                  return (
                    <div key={sheet.sheetName} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <input
                          value={listNames[sheet.sheetName] ?? sheet.sheetName}
                          onChange={(event) => setListNames((prev) => ({ ...prev, [sheet.sheetName]: event.target.value }))}
                          className="h-10 w-full max-w-xs rounded-xl border border-slate-200 px-3 text-sm font-bold outline-none focus:border-[#C5A059]"
                          aria-label={`Nombre de lista de ${sheet.sheetName}`}
                        />
                        {sheet.mapping ? (
                          <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-bold text-emerald-700">
                            Columna email: {sheet.mapping.email}
                          </span>
                        ) : (
                          <select
                            value={emailColumns[sheet.sheetName] ?? ""}
                            onChange={(event) => setEmailColumns((prev) => ({ ...prev, [sheet.sheetName]: event.target.value }))}
                            className={`h-10 rounded-xl border px-3 text-sm font-semibold outline-none ${needsEmail ? "border-amber-300 bg-amber-50 text-amber-800" : "border-slate-200"}`}
                          >
                            <option value="">Seleccionar columna de email…</option>
                            {sheet.headers.map((header) => header && <option key={header} value={header}>{header}</option>)}
                          </select>
                        )}
                      </div>
                      {needsEmail && (
                        <p className="mt-2 text-xs font-semibold text-amber-700">REQUIERE CONFIGURACIÓN: seleccione la columna de email.</p>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="rounded-2xl border border-slate-200">
                <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
                  <h3 className="text-sm font-black uppercase tracking-wide text-slate-700">Revisar destinatarios</h3>
                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Buscar nombre, empresa, correo"
                        className="h-9 w-56 rounded-lg border border-slate-200 pl-8 pr-3 text-xs outline-none focus:border-[#C5A059]"
                      />
                    </div>
                    <select value={previewSheet} onChange={(event) => setPreviewSheet(event.target.value)} className="h-9 rounded-lg border border-slate-200 px-2 text-xs font-semibold">
                      <option value="all">Todas las hojas</option>
                      {preview.sheets.map((sheet) => <option key={sheet.sheetName} value={sheet.sheetName}>{sheet.sheetName}</option>)}
                    </select>
                    <select value={previewFilter} onChange={(event) => setPreviewFilter(event.target.value as PreviewFilter)} className="h-9 rounded-lg border border-slate-200 px-2 text-xs font-semibold">
                      <option value="all">Todos</option>
                      <option value="valid">Válidos</option>
                      <option value="invalid">Inválidos</option>
                      <option value="duplicate">Duplicados</option>
                      <option value="existing">Existentes</option>
                    </select>
                  </div>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-400">
                      <tr>
                        <th className="px-4 py-2">Estado</th>
                        <th className="px-4 py-2">Nombre</th>
                        <th className="px-4 py-2">Empresa</th>
                        <th className="px-4 py-2">Correo</th>
                        <th className="px-4 py-2">Hoja</th>
                        <th className="px-4 py-2">Fila</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredRows.map((row, index) => {
                        const badge = statusBadge[row.status] ?? statusBadge.VALID;
                        return (
                          <tr key={`${row.sheetName}-${row.rowNumber}-${index}`}>
                            <td className="px-4 py-2"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${badge.className}`}>{badge.label}</span></td>
                            <td className="px-4 py-2 font-semibold text-slate-700">{row.name || "—"}</td>
                            <td className="px-4 py-2 text-slate-600">{row.company || "—"}</td>
                            <td className="px-4 py-2 text-slate-700">{row.email}</td>
                            <td className="px-4 py-2 text-slate-500">{row.sheetName}</td>
                            <td className="px-4 py-2 text-slate-500">{row.rowNumber}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {step === "result" && result && (
            <div className="space-y-5">
              <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                <CheckCircle2 className="h-7 w-7 shrink-0 text-emerald-600" />
                <div>
                  <p className="text-base font-black text-emerald-800">Importación completada</p>
                  <p className="mt-0.5 text-xs text-emerald-700">
                    {result.recipientsNew} destinatarios registrados · {result.listsCreated} listas procesadas · {result.membershipsCreated} membresías · {result.duplicate} duplicados consolidados · {result.invalid} inválidos
                  </p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ["Listas creadas", result.listsCreated],
                  ["Listas existentes", result.listsExisting],
                  ["Membresías creadas", result.membershipsCreated],
                  ["Nuevos", result.recipientsNew],
                  ["Existentes", result.recipientsExisting],
                  ["Correos encontrados", result.foundEmails],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-slate-200 p-4">
                    <p className="text-[10px] font-bold uppercase text-slate-400">{label}</p>
                    <p className="mt-1 text-2xl font-black text-slate-800">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <footer className="flex shrink-0 justify-between gap-3 border-t border-slate-100 bg-slate-50/50 px-8 py-5">
          <button
            type="button"
            onClick={() => {
              if (step === "review") setStep("select");
              else onClose();
            }}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {step === "review" ? <ArrowLeft size={16} /> : null} {step === "review" ? "Volver" : step === "result" ? "Cerrar" : "Cancelar"}
          </button>

          {step === "select" && (
            <button
              type="button"
              onClick={() => void handleProcess()}
              disabled={busy || !selectedFile}
              className="inline-flex items-center gap-2 rounded-xl bg-[#C5A059] px-8 py-2.5 text-sm font-black text-white shadow-md disabled:cursor-not-allowed disabled:opacity-50"
            >
              {selectedFile ? "Revisar archivo" : "Continuar"}
            </button>
          )}

          {step === "review" && (
            <button
              type="button"
              onClick={() => void handleConfirm()}
              disabled={busy || requiresConfig}
              className="inline-flex items-center gap-2 rounded-xl bg-[#C5A059] px-8 py-2.5 text-sm font-black text-white shadow-md disabled:cursor-not-allowed disabled:opacity-50"
            >
              Confirmar importación
            </button>
          )}

          {step === "result" && (
            <button type="button" onClick={onImported} className="inline-flex items-center gap-2 rounded-xl bg-[#C5A059] px-8 py-2.5 text-sm font-black text-white shadow-md">
              Ver destinatarios
            </button>
          )}
        </footer>
      </div>

      <ProcessLoadingOverlay open={busy} title={loadingTitle} description={loadingDescription} />
    </div>,
    document.body,
  );
}
