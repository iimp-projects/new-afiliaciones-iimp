"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Paperclip, FileText, X, UploadCloud } from "lucide-react";
import { RichTextEditor } from "@/modules/shared/Components/RichTextEditor/RichTextEditor";
import { formatStatusName } from "../Utils/expedientes.utils";

interface StatusUpdateModalProps {
  targetStatus: string;
  onClose: () => void;
  onConfirm: (status: string, reasonHtml: string, files: File[]) => Promise<void>;
}

export function StatusUpdateModal({ targetStatus, onClose, onConfirm }: StatusUpdateModalProps) {
  const [statusReason, setStatusReason] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setIsMounted(true); }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setAttachments((prev) => [...prev, ...newFiles]);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (indexToRemove: number) => {
    setAttachments((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleConfirm = async () => {
    if (statusReason === "<p></p>" || statusReason.trim() === "") return;
    setIsSubmitting(true);
    try {
      await onConfirm(targetStatus, statusReason, attachments);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isMounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[99999999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden animate-in zoom-in-95">
        <div className="p-6 text-center border-b border-gray-100 bg-gray-50/50">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border ${targetStatus === 'REJECTED' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-amber-100 text-amber-600 border-amber-200'}`}>
            <AlertTriangle size={28} />
          </div>
          <h2 className="text-xl font-black text-slate-800 tracking-tight">
            {targetStatus === "OBSERVED" ? "¿Observar Expediente?" : targetStatus === "PENDING" ? "¿Reevaluar Expediente?" : "¿Otorgar Conformidad?"}
          </h2>
          <p className="text-sm text-slate-500 mt-2 px-4">
            Está a punto de cambiar el estado a <strong className="text-slate-800 uppercase">{formatStatusName(targetStatus)}</strong>.
          </p>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2 ml-1">
              Motivo o Comentario <span className="text-red-500">*</span>
            </label>
            <RichTextEditor value={statusReason} onChange={(val) => setStatusReason(val || "")} placeholder="Describa el motivo..." />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2 ml-1 pr-1">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                Evidencia Adjunta <span className="text-gray-400 font-normal normal-case">(Opcional)</span>
              </label>
              <button type="button" onClick={() => fileInputRef.current?.click()} className="text-xs font-bold text-[#c39254] flex items-center gap-1 hover:text-[#7f561e] transition-colors bg-[#c39254]/10 px-2 py-1 rounded-md">
                <Paperclip size={14} /> Añadir archivo
              </button>
              <input type="file" multiple className="hidden" ref={fileInputRef} onChange={handleFileChange} />
            </div>

            {attachments.length > 0 ? (
              <ul className="space-y-2 max-h-36 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 pr-2">
                {attachments.map((file, idx) => (
                  <li key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 border border-gray-200">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center shrink-0">
                        <FileText size={16} className="text-slate-400" />
                      </div>
                      <div className="flex flex-col truncate">
                        <span className="text-sm font-bold text-slate-700 truncate">{file.name}</span>
                        <span className="text-[10px] text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                      </div>
                    </div>
                    <button onClick={() => removeFile(idx)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md">
                      <X size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div onClick={() => fileInputRef.current?.click()} className="w-full py-5 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center text-slate-400 hover:border-[#c39254] hover:bg-[#c39254]/5 transition-all cursor-pointer">
                <UploadCloud size={20} className="mb-2" />
                <span className="text-sm font-bold">Clic para adjuntar archivo</span>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 pt-2 flex gap-3">
          <button onClick={onClose} disabled={isSubmitting} className="flex-1 py-3.5 rounded-xl border-2 border-gray-200 text-slate-600 font-bold text-sm hover:bg-gray-50">Cancelar</button>
          <button onClick={handleConfirm} disabled={isSubmitting || statusReason === "<p></p>" || statusReason.trim() === ""} className={`flex-1 py-3.5 rounded-xl text-white font-black text-sm shadow-md transition-all disabled:opacity-50 ${targetStatus === "OBSERVED" ? "bg-amber-500" : targetStatus === "REJECTED" ? "bg-red-600" : "bg-gradient-to-r from-[#dca45c] to-[#c39254]"}`}>
            {isSubmitting ? "Actualizando..." : "Sí, confirmar"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}