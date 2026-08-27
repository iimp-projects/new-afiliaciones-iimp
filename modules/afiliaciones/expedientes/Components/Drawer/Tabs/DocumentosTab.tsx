"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { 
  FileText, 
  Image as ImageIcon, 
  FileSignature, 
  CreditCard, 
  GraduationCap, 
  FileCheck, 
  Eye, 
  Download, 
  X, 
  ExternalLink,
  FileQuestion
} from "lucide-react";

// ==========================================
// CONFIGURACIÓN VISUAL POR CATEGORÍA
// ==========================================
const documentMetaConfig: Record<string, any> = {
  ID_DOCUMENT: { 
    title: "Documento de Identidad Oficial", 
    icon: FileText, 
    color: "text-blue-600", 
    bg: "bg-blue-50", 
    border: "border-blue-200" 
  },
  PAYMENT_VOUCHER: { 
    title: "Comprobante de Pago / Voucher", 
    icon: CreditCard, 
    color: "text-emerald-600", 
    bg: "bg-emerald-50", 
    border: "border-emerald-200" 
  },
  SWORN_DECLARATION: { 
    title: "Declaración Jurada Firmada", 
    icon: FileSignature, 
    color: "text-amber-600", 
    bg: "bg-amber-50", 
    border: "border-amber-200" 
  },
  CV: { 
    title: "Curriculum Vitae", 
    icon: FileCheck, 
    color: "text-indigo-600", 
    bg: "bg-indigo-50", 
    border: "border-indigo-200" 
  },
  DEGREE_CERTIFICATE: { 
    title: "Constancia de Estudios o Grado", 
    icon: GraduationCap, 
    color: "text-purple-600", 
    bg: "bg-purple-50", 
    border: "border-purple-200" 
  },
  RECOMMENDATION_LETTER: { 
    title: "Carta de Recomendación", 
    icon: FileText, 
    color: "text-rose-600", 
    bg: "bg-rose-50", 
    border: "border-rose-200" 
  },
  OTHER: { 
    title: "Documento Adicional", 
    icon: FileQuestion, 
    color: "text-slate-600", 
    bg: "bg-slate-50", 
    border: "border-slate-200" 
  },
};

interface DocumentosTabProps {
  payload?: any;
  documents?: any[];
  onOpenDocument?: (url: string) => Promise<void>;
}

export function DocumentosTab({ payload, documents: directDocuments, onOpenDocument }: DocumentosTabProps) {
  const documents: any[] = directDocuments || payload?.documents || [];
  
  const [previewDoc, setPreviewDoc] = useState<any>(null);
  const [loadingDocId, setLoadingDocId] = useState<string | null>(null);

  // Función para ocultar el hash feo de AWS S3 y limpiar nombres
  const formatFileName = (fileName: string, mimeType: string) => {
    if (!fileName || fileName === "03" || fileName === "1") {
      return (mimeType && mimeType.includes("pdf")) ? "documento_adjunto.pdf" : "imagen_adjunta.jpg";
    }
    if (fileName.length > 35) {
      return `doc_...${fileName.substring(fileName.length - 10)}`;
    }
    return fileName;
  };

  const getFormatDisplay = (mimeType: string) => {
    if (!mimeType) return "DESCONOCIDO";
    if (mimeType.includes("pdf")) return "PDF";
    if (mimeType.includes("image") || mimeType.includes("jpeg") || mimeType.includes("png")) return "IMAGEN";
    return "ARCHIVO";
  };

  // ==========================================
  // LÓGICA DE FIRMAS TEMPORALES (S3 PRESIGNED)
  // ==========================================
  const getSecureUrl = async (rawUrl: string) => {
    try {
      const res = await fetch(`/api/afiliaciones/postulacion/file?url=${encodeURIComponent(rawUrl)}`);
      const data = await res.json();
      if (data.success && data.data?.url) {
        return data.data.url;
      }
      return null;
    } catch (error) {
      console.error("Error obteniendo URL segura:", error);
      return null;
    }
  };

  const handlePreview = async (doc: any, meta: any, formatBadge: string) => {
    setLoadingDocId(`preview-${doc.id}`);
    
    const secureUrl = await getSecureUrl(doc.fileUrl);
    setLoadingDocId(null);

    if (secureUrl) {
      setPreviewDoc({ url: secureUrl, type: formatBadge, name: meta.title });
    } else {
      alert("No se pudo obtener el acceso seguro a este documento.");
    }
  };

  const handleDownloadSecure = async (doc: any, cleanName: string) => {
    setLoadingDocId(`download-${doc.id}`);
    
    const secureUrl = await getSecureUrl(doc.fileUrl);
    setLoadingDocId(null);

    if (!secureUrl) {
      alert("No se pudo obtener el acceso seguro para descargar.");
      return;
    }

    try {
      const response = await fetch(secureUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = cleanName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      window.open(secureUrl, '_blank');
    }
  };

  if (!documents || documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-slate-200 border-dashed">
        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
          <FileQuestion className="w-8 h-8 text-slate-300" />
        </div>
        <h3 className="text-lg font-bold text-slate-700">Sin documentos</h3>
        <p className="text-sm text-slate-500 mt-1 text-center max-w-sm">
          Este expediente no tiene documentos adjuntos o están siendo procesados.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {documents.map((doc: any) => {
        let meta = documentMetaConfig[doc.category] || documentMetaConfig.OTHER;
        const cleanName = formatFileName(doc.fileName, doc.mimeType);
        const formatBadge = getFormatDisplay(doc.mimeType);

        // ✅ REGLA INTELIGENTE: Si es "OTHER" y es una imagen, lo convertimos visualmente en "Foto Personal"
        if (doc.category === "OTHER" && (formatBadge === "IMAGEN" || /foto|photo|perfil/i.test(doc.fileName || ""))) {
          meta = {
            title: "Fotografía Personal",
            icon: ImageIcon,
            color: "text-fuchsia-600",
            bg: "bg-fuchsia-50",
            border: "border-fuchsia-200"
          };
        }

        const Icon = meta.icon;

        return (
          <div key={doc.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md hover:border-[#C5A059]/40 transition-all duration-300 group">
            
            <div className="flex items-center gap-4 mb-4 sm:mb-0">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${meta.bg} ${meta.border} ${meta.color} group-hover:scale-105 transition-transform`}>
                <Icon size={22} strokeWidth={2} />
              </div>
              
              <div className="flex flex-col">
                <h4 className="text-[14px] font-black text-slate-800 tracking-tight leading-none mb-1.5">
                  {meta.title}
                </h4>
                <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400">
                  <span className="truncate max-w-[200px]" title={doc.fileName}>{cleanName}</span>
                  <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                  <span className={`px-1.5 py-0.5 rounded uppercase tracking-wider border ${formatBadge === 'PDF' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                    {formatBadge}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button 
                type="button"
                onClick={() => handlePreview(doc, meta, formatBadge)}
                disabled={loadingDocId !== null}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 h-10 bg-white border border-slate-200 text-slate-600 hover:text-[#C5A059] hover:border-[#C5A059] hover:bg-[#fffdf8] font-bold text-xs rounded-xl transition-all shadow-sm focus:outline-none disabled:opacity-50"
              >
                {loadingDocId === `preview-${doc.id}` ? (
                  <span className="animate-spin w-4 h-4 border-2 border-[#C5A059] border-t-transparent rounded-full"></span>
                ) : (
                  <Eye size={16} />
                )}
                Previsualizar
              </button>
              
              <button 
                type="button"
                onClick={() => handleDownloadSecure(doc, cleanName)}
                disabled={loadingDocId !== null}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 h-10 bg-[#C5A059] hover:bg-[#a67c3b] text-white font-bold text-xs rounded-xl shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5 focus:outline-none disabled:opacity-50"
              >
                {loadingDocId === `download-${doc.id}` ? (
                  <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
                ) : (
                  <Download size={16} />
                )}
                Descargar
              </button>
            </div>

          </div>
        );
      })}

      {/* MODAL DE PREVISUALIZACIÓN FULLSCREEN */}
      {previewDoc && createPortal(
        <div className="fixed inset-0 z-[999999] flex flex-col bg-slate-900/95 backdrop-blur-md animate-in fade-in duration-200">
          <div className="h-16 px-6 border-b border-white/10 flex items-center justify-between shrink-0 bg-black/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#C5A059]/20 border border-[#C5A059]/30 flex items-center justify-center text-[#e8d09e]">
                {previewDoc.type === 'PDF' ? <FileText size={20} /> : <ImageIcon size={20} />}
              </div>
              <h3 className="text-white font-bold text-lg tracking-wide">{previewDoc.name}</h3>
            </div>
            
            <div className="flex items-center gap-3">
              <button 
                type="button"
                onClick={() => window.open(previewDoc.url, '_blank')} 
                className="px-4 h-10 bg-white/10 hover:bg-white/20 text-white font-bold text-sm rounded-xl flex items-center gap-2 transition-colors border border-white/10"
              >
                <ExternalLink size={16} /> Abrir en pestaña nueva
              </button>
              <button 
                type="button"
                onClick={() => setPreviewDoc(null)} 
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/10 hover:bg-red-500 hover:text-white text-slate-300 transition-colors"
                title="Cerrar (Esc)"
              >
                <X size={24} />
              </button>
            </div>
          </div>

          <div className="flex-1 w-full h-full p-4 md:p-8 overflow-hidden flex items-center justify-center relative">
            {previewDoc.type === 'IMAGEN' ? (
              <img 
                src={previewDoc.url} 
                alt="Vista previa" 
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-300"
              />
            ) : previewDoc.type === 'PDF' ? (
              <iframe 
                src={`${previewDoc.url}#toolbar=0`} 
                className="w-full h-full max-w-5xl rounded-2xl shadow-2xl bg-white animate-in zoom-in-95 duration-300"
                title="Visor PDF"
              />
            ) : (
              <div className="text-center text-white/50">
                <FileQuestion size={64} className="mx-auto mb-4 opacity-50" />
                <p className="font-bold text-lg">Formato no soportado para previsualización.</p>
                <p className="text-sm mt-2">Por favor, utilice el botón de descarga.</p>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}