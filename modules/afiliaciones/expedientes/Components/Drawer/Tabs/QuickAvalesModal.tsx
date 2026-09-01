import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Users, Loader2 } from "lucide-react";
import { AvalesTab } from "./AvalesTab"; // Ajusta la ruta a tu AvalesTab real

interface QuickAvalesModalProps {
  isOpen: boolean;
  onClose: () => void;
  applicationId: number; // Recibimos el ID para buscar la data si es necesario
  fullPayload?: any; // Si ya tienes la data cargada, la pasas directo
  onReplaceAval?: (avalId: number) => void;
  onSendMessage?: (avalId: number, message: string) => void;
}

export function QuickAvalesModal({ 
  isOpen, 
  onClose, 
  applicationId, 
  fullPayload, 
  onReplaceAval, 
  onSendMessage 
}: QuickAvalesModalProps) {
  const [payload, setPayload] = useState<any>(fullPayload || null);
  const [loading, setLoading] = useState(!fullPayload);

  // Si no pasaste el fullPayload (porque la tarjeta principal no lo tiene completo), 
  // hacemos un fetch rápido del expediente aquí mismo.
  useEffect(() => {
    if (isOpen && !fullPayload && applicationId) {
      setLoading(true);
      fetch(`/api/afiliaciones/expedientes/${applicationId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setPayload(data.data);
          }
        })
        .finally(() => setLoading(false));
    } else if (fullPayload) {
      setPayload(fullPayload);
      setLoading(false);
    }
  }, [isOpen, applicationId, fullPayload]);

  if (!isOpen) return null;

  const applicantName = payload 
    ? `${payload.person?.firstName} ${payload.person?.paternalLastName}` 
    : "Cargando...";
  const trackingCode = payload?.trackingCode || payload?.applicationCode || "---";
  const document = payload?.person?.documentNumber || payload?.documentNumber || "---";

  return createPortal(
    <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 sm:p-6">
      {/* Fondo oscuro con desenfoque */}
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      ></div>
      
      {/* Contenedor del Modal */}
      <div className="bg-[#F4F5F7] rounded-[32px] w-full max-w-5xl shadow-2xl flex flex-col max-h-[90vh] relative z-10 animate-in zoom-in-95 duration-200 overflow-hidden">
        
        {/* Header del Modal */}
        <div className="px-6 py-5 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm shrink-0">
              <Users size={24} strokeWidth={2.5} />
            </div>
            <div className="flex flex-col">
              <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Revisión Rápida de Avales</h2>
              <p className="text-[12px] font-bold text-slate-500 mt-0.5">
                Exp. <span className="text-[#C5A059]">{trackingCode}</span> • {applicantName} (DNI {document})
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500 border border-slate-200 hover:border-red-200 rounded-full transition-all shadow-sm focus:outline-none"
            title="Cerrar modal"
          >
            <X size={20} strokeWidth={2.5} />
          </button>
        </div>

        {/* Cuerpo del Modal */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 scrollbar-thin scrollbar-thumb-slate-200">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-[#C5A059]" />
              <span className="text-sm font-bold">Obteniendo datos de los avales...</span>
            </div>
          ) : payload ? (
            // Reutilizamos el componente premium que ya programamos
            <AvalesTab 
              payload={payload} 
              onReplaceAval={onReplaceAval} 
              onSendMessage={onSendMessage} 
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-red-400 gap-2">
              <span className="text-lg font-bold">Error al cargar la información del expediente.</span>
            </div>
          )}
        </div>
        
      </div>
    </div>,
    document.body
  );
}