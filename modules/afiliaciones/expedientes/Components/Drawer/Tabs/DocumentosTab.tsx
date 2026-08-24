import React from "react";
import { FileText, Eye, Download } from "lucide-react";
import { getDocumentFriendlyName } from "../../../Utils/expedientes.utils";

interface DocumentosTabProps {
  documents: any[];
  onOpenDocument: (url: string) => void;
}

export function DocumentosTab({ documents, onOpenDocument }: DocumentosTabProps) {
  if (!documents || documents.length === 0) {
    return (
      <div className="text-center p-12 text-slate-400 bg-white rounded-2xl border border-slate-200 border-dashed">
        No hay documentos adjuntos para este expediente.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {documents.map((doc: any) => {
        const friendlyName = getDocumentFriendlyName(doc.category);
        const fileExtension = doc.fileName?.split(".").pop()?.toUpperCase() || "PDF";

        return (
          <div
            key={doc.id}
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:border-[#C5A059] transition-all"
          >
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 text-[#C5A059]">
                <FileText size={24} />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[14px] font-black text-slate-800 truncate">
                  {friendlyName}
                </span>
                <span className="text-[11px] font-medium text-slate-400 mt-0.5 truncate">
                  Archivo: {doc.fileName} • Formato: <strong className="text-slate-600">{fileExtension}</strong>
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100">
              <button
                onClick={() => onOpenDocument(doc.fileUrl)}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:border-[#C5A059] hover:text-[#C5A059] rounded-xl text-xs font-bold transition-all shadow-sm"
              >
                <Eye size={15} /> Previsualizar
              </button>
              <button
                onClick={() => onOpenDocument(doc.fileUrl)}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 bg-[#C5A059] text-white hover:bg-[#b58f48] rounded-xl text-xs font-bold transition-all shadow-sm"
              >
                <Download size={15} /> Descargar
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}