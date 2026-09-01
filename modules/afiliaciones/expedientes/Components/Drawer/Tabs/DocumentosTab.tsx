"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, CheckCircle2, CreditCard, Download, Eye, ExternalLink, FileCheck, FileQuestion, FileSignature, FileText, GraduationCap, Image as ImageIcon, X } from "lucide-react";

const documentMetaConfig: Record<string, any> = {
  ID_DOCUMENT: { title: "Documento de Identidad Oficial", icon: FileText },
  PAYMENT_VOUCHER: { title: "Comprobante de Pago / Voucher", icon: CreditCard },
  SWORN_DECLARATION: { title: "Declaración Jurada Firmada", icon: FileSignature },
  CV: { title: "Curriculum Vitae", icon: FileCheck },
  DEGREE_CERTIFICATE: { title: "Constancia de Estudios o Grado", icon: GraduationCap },
  RECOMMENDATION_LETTER: { title: "Carta de Recomendación", icon: FileText },
  OTHER: { title: "Documento Adicional", icon: FileQuestion },
};

interface DocumentosTabProps { payload?: any; documents?: any[]; onOpenDocument?: (url: string) => Promise<void>; }
interface PreviewDocument { url: string; type: string; name: string; fileName: string; }

export function DocumentosTab({ payload, documents: directDocuments, onOpenDocument }: DocumentosTabProps) {
  const documents: any[] = directDocuments || payload?.documents || [];
  const [previewDoc, setPreviewDoc] = useState<PreviewDocument | null>(null);
  const [loadingDocId, setLoadingDocId] = useState<string | null>(null);

  const formatFileName = (fileName: string, mimeType: string) => {
    if (!fileName || fileName === "03" || fileName === "1") return mimeType?.includes("pdf") ? "documento_adjunto.pdf" : "imagen_adjunta.jpg";
    if (fileName.length > 35) return `doc_...${fileName.substring(fileName.length - 10)}`;
    return fileName;
  };

  const getFormatDisplay = (mimeType: string) => {
    if (!mimeType) return "DESCONOCIDO";
    if (mimeType.includes("pdf")) return "PDF";
    if (mimeType.includes("image") || mimeType.includes("jpeg") || mimeType.includes("png")) return "IMAGEN";
    return "ARCHIVO";
  };

  const getSecureUrl = async (rawUrl: string) => {
    try {
      const res = await fetch(`/api/afiliaciones/postulacion/file?url=${encodeURIComponent(rawUrl)}`);
      const data = await res.json();
      return data.success && data.data?.url ? data.data.url : null;
    } catch (error) {
      console.error("Error obteniendo URL segura:", error);
      return null;
    }
  };

  const handlePreview = async (doc: any, meta: any, formatBadge: string, cleanName: string) => {
    if (!doc?.fileUrl) return alert("Este documento no tiene una URL disponible.");
    setLoadingDocId(`preview-${doc.id}`);
    const secureUrl = await getSecureUrl(doc.fileUrl);
    setLoadingDocId(null);
    if (!secureUrl) return alert("No se pudo obtener el acceso seguro a este documento.");

    if (onOpenDocument) {
      try { await onOpenDocument(secureUrl); } catch (error) { console.error("Error ejecutando onOpenDocument:", error); }
    }

    setPreviewDoc({ url: secureUrl, type: formatBadge, name: meta.title, fileName: cleanName });
  };

  const handleDownloadSecure = async (doc: any, cleanName: string) => {
    if (!doc?.fileUrl) return alert("Este documento no tiene una URL disponible.");
    setLoadingDocId(`download-${doc.id}`);
    const secureUrl = await getSecureUrl(doc.fileUrl);
    setLoadingDocId(null);
    if (!secureUrl) return alert("No se pudo obtener el acceso seguro para descargar.");

    try {
      const response = await fetch(secureUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = cleanName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(secureUrl, "_blank");
    }
  };

  useEffect(() => {
    if (!previewDoc) return;
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setPreviewDoc(null); };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [previewDoc]);

  if (!documents.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white p-12">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50"><FileQuestion className="h-8 w-8 text-slate-300" /></div>
        <h3 className="text-lg font-bold text-slate-700">Sin documentos</h3>
        <p className="mt-1 max-w-sm text-center text-sm text-slate-500">Este expediente no tiene documentos adjuntos o están siendo procesados.</p>
      </div>
    );
  }

  const totalExpectedDocuments = 4;
  const uploadedCount = Math.min(documents.length, totalExpectedDocuments);
  const progress = Math.min(100, Math.round((uploadedCount / totalExpectedDocuments) * 100));
  const circumference = 2 * Math.PI * 23;
  const dashOffset = circumference - (progress / 100) * circumference;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 space-y-4 duration-300">
      {/* Encabezado */}
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 sm:px-5">
        <div className="flex items-center justify-between gap-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500"><FileText size={19} strokeWidth={1.8} /></div>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-black tracking-tight text-slate-800">Documentos presentados</h3>
              <p className="mt-0.5 text-xs text-slate-400">Documentación cargada por el postulante.</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <div className="relative h-12 w-12">
              <svg viewBox="0 0 56 56" className="h-12 w-12 -rotate-90" aria-hidden="true">
                <circle cx="28" cy="28" r="23" fill="none" stroke="currentColor" strokeWidth="4" className="text-slate-100" />
                <circle cx="28" cy="28" r="23" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={dashOffset} className="text-emerald-500 transition-all duration-500" />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[11px] font-black text-slate-700">{uploadedCount}/{totalExpectedDocuments}</span>
            </div>
            <div className="hidden sm:block">
              <p className="text-xs font-bold text-slate-700">Documentos</p>
              <p className="text-[11px] text-slate-400">{progress}% cargados</p>
            </div>
          </div>
        </div>
      </div>

      {/* Checklist */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="hidden grid-cols-[minmax(0,1fr)_110px_minmax(120px,0.8fr)_210px] items-center border-b border-slate-100 bg-slate-50/60 px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-slate-400 sm:grid">
          <span>Documento</span><span>Tipo</span><span>Archivo</span><span className="text-center">Acciones</span>
        </div>

        {documents.map((doc: any) => {
          let meta = documentMetaConfig[doc.category] || documentMetaConfig.OTHER;
          const cleanName = formatFileName(doc.fileName, doc.mimeType);
          const formatBadge = getFormatDisplay(doc.mimeType);

          if (doc.category === "OTHER" && (formatBadge === "IMAGEN" || /foto|photo|perfil/i.test(doc.fileName || ""))) {
            meta = { title: "Fotografía Personal", icon: ImageIcon };
          }

          const Icon = meta.icon;

          return (
            <div key={doc.id} className="group border-b border-slate-100 px-4 py-3 last:border-b-0 transition-colors hover:bg-slate-50 sm:px-4">
              {/* Desktop */}
              <div className="hidden grid-cols-[minmax(0,1fr)_110px_minmax(120px,0.8fr)_210px] items-center sm:grid">
                <div className="flex min-w-0 items-center gap-3 pr-4">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center text-emerald-500">
                    <CheckCircle2 size={16} strokeWidth={1.7} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-black leading-snug text-slate-800">{meta.title}</p>
                    <div className="mt-1 flex min-w-0 items-center gap-2">
                      <Icon size={12} strokeWidth={1.8} className="shrink-0 text-slate-400" />
                      <span className="truncate text-[10px] font-medium text-slate-400" title={doc.fileName}>{cleanName}</span>
                    </div>
                  </div>
                </div>

                <div className="pr-3"><span className="text-[11px] font-normal text-slate-400">{formatBadge}</span></div>

                <div className="min-w-0 pr-4"><span className="block truncate text-[10px] font-medium text-slate-400" title={doc.fileName}>{cleanName}</span></div>

                <div className="flex items-center justify-center gap-1">
                  <button
                    type="button"
                    onClick={() => handlePreview(doc, meta, formatBadge, cleanName)}
                    disabled={loadingDocId !== null}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
                    title={`Visualizar ${meta.title}`}
                    aria-label={`Visualizar ${meta.title}`}
                  >
                    {loadingDocId === `preview-${doc.id}` ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" /> : <Eye size={17} strokeWidth={1.8} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadSecure(doc, cleanName)}
                    disabled={loadingDocId !== null}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
                    title={`Descargar ${meta.title}`}
                    aria-label={`Descargar ${meta.title}`}
                  >
                    {loadingDocId === `download-${doc.id}` ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" /> : <Download size={17} strokeWidth={1.8} />}
                  </button>
                </div>
              </div>

              {/* Mobile */}
              <div className="flex items-center justify-between gap-3 sm:hidden">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center text-emerald-500"><CheckCircle2 size={16} strokeWidth={1.7} /></div>
                  <div className="min-w-0">
                    <p className="truncate text-[12px] font-black text-slate-800">{meta.title}</p>
                    <p className="mt-0.5 truncate text-[10px] font-medium text-slate-400">{cleanName} · {formatBadge}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button type="button" onClick={() => handlePreview(doc, meta, formatBadge, cleanName)} disabled={loadingDocId !== null} className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus:outline-none disabled:opacity-40" title={`Visualizar ${meta.title}`} aria-label={`Visualizar ${meta.title}`}>
                    {loadingDocId === `preview-${doc.id}` ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" /> : <Eye size={17} strokeWidth={1.8} />}
                  </button>
                  <button type="button" onClick={() => handleDownloadSecure(doc, cleanName)} disabled={loadingDocId !== null} className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus:outline-none disabled:opacity-40" title={`Descargar ${meta.title}`} aria-label={`Descargar ${meta.title}`}>
                    {loadingDocId === `download-${doc.id}` ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" /> : <Download size={16} strokeWidth={1.8} />}
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-4 py-3">
          <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-400"><CheckCircle2 size={15} strokeWidth={1.7} className="text-emerald-500" /><span>{documents.length} documento{documents.length === 1 ? "" : "s"} cargado{documents.length === 1 ? "" : "s"}</span></div>
          <span className="text-[10px] font-semibold text-slate-300">Solo lectura</span>
        </div>
      </div>

      {/* Información */}
      <div className="flex items-center gap-2 px-1 pt-1 pb-0.5">
        <AlertCircle size={13} strokeWidth={1.8} className="shrink-0 text-blue-400" />
        <p className="text-[10px] font-normal text-slate-400">Los documentos son de solo lectura: solo pueden visualizarse o descargarse.</p>
      </div>

      {/* Modal de previsualización */}
      {previewDoc && createPortal(
        <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) setPreviewDoc(null); }}>
          <div className="flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex min-h-[72px] shrink-0 items-center justify-between gap-4 border-b border-slate-200 px-4 sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500">{previewDoc.type === "PDF" ? <FileText size={20} strokeWidth={1.8} /> : <ImageIcon size={20} strokeWidth={1.8} />}</div>
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-black text-slate-800 sm:text-base">{previewDoc.name}</h3>
                  <div className="mt-1 flex items-center gap-2 text-[10px] font-semibold text-slate-400 sm:text-[11px]"><span className="truncate">{previewDoc.fileName}</span><span>•</span><span>{previewDoc.type}</span></div>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button type="button" onClick={() => window.open(previewDoc.url, "_blank")} className="hidden h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 sm:flex"><ExternalLink size={15} />Abrir en pestaña</button>
                <button type="button" onClick={async () => { try { const response = await fetch(previewDoc.url); const blob = await response.blob(); const blobUrl = window.URL.createObjectURL(blob); const link = document.createElement("a"); link.href = blobUrl; link.download = previewDoc.fileName; document.body.appendChild(link); link.click(); document.body.removeChild(link); window.URL.revokeObjectURL(blobUrl); } catch { window.open(previewDoc.url, "_blank"); } }} className="flex h-10 items-center gap-2 rounded-xl border border-[#C5A059] bg-[#C5A059] px-3 text-xs font-bold text-white transition-colors hover:bg-[#b28d4c]"><Download size={15} /><span className="hidden sm:inline">Descargar</span></button>
                <button type="button" onClick={() => setPreviewDoc(null)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800" title="Cerrar (Esc)" aria-label="Cerrar previsualización"><X size={20} /></button>
              </div>
            </div>

            <div className="min-h-0 flex-1 bg-slate-100 p-3 sm:p-6">
              <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-200">
                {previewDoc.type === "IMAGEN" ? (
                  <img src={previewDoc.url} alt={`Vista previa de ${previewDoc.name}`} className="max-h-full max-w-full object-contain" />
                ) : previewDoc.type === "PDF" ? (
                  <iframe src={`${previewDoc.url}#toolbar=0&navpanes=0`} className="h-full w-full bg-white" title={`Visor de ${previewDoc.name}`} />
                ) : (
                  <div className="px-6 text-center text-slate-500"><FileQuestion size={56} className="mx-auto mb-4 text-slate-300" /><p className="text-base font-bold text-slate-700">Vista previa no disponible</p><p className="mt-2 text-sm">Utiliza el botón Descargar para consultar el archivo.</p></div>
                )}
              </div>
            </div>

            <div className="flex min-h-[50px] shrink-0 items-center justify-between border-t border-slate-200 bg-white px-4 sm:px-6">
              <span className="text-[10px] font-semibold text-slate-400 sm:text-xs">Solo lectura · No se permite editar el documento</span>
              <button type="button" onClick={() => setPreviewDoc(null)} className="text-xs font-bold text-slate-600 hover:text-slate-900">Cerrar</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
