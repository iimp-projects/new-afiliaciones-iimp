"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Info, X } from "lucide-react";

interface ApplicationFooterProps {
  currentStep: number;
  isSubmitting?: boolean;
  showCancel?: boolean;
  showPrevious?: boolean;
  nextLabel?: string;
  onCancel: () => void;
  onPrevious?: () => void;
  onNext: () => void;
}

export default function ApplicationFooter({
  currentStep,
  isSubmitting = false,
  showCancel = true,
  showPrevious = true,
  nextLabel = "Guardar y Continuar",
  onCancel,
  onPrevious,
  onNext,
}: ApplicationFooterProps) {
  const [showInfo, setShowInfo] = useState(false);
  return (
    <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 py-4 z-[100] shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center justify-between">
        
        {/* IZQUIERDA: Botón Cancelar */}
        <div>
          {showCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="
                group
                px-5
                py-3
                rounded-xl
                text-slate-400
                font-bold
                text-sm
                hover:bg-red-50
                hover:text-red-500
                transition-all
                duration-300
                flex
                items-center
                gap-2
              "
            >
              <X size={18} strokeWidth={3} className="group-hover:rotate-90 transition-transform duration-300" />
              <span>Cancelar</span>
            </button>
          )}
        </div>
        {/* DERECHA: Botones de Navegación */}
        <div className="flex items-center gap-4">
          {currentStep > 1 && showPrevious && (
            <button
              type="button"
              onClick={onPrevious}
              className="
                group
                px-6
                py-3
                rounded-xl
                bg-white
                border-2
                border-gray-200
                text-[#2F3136]
                font-bold
                text-sm
                hover:border-[#2F3136]
                hover:bg-gray-50
                transition-all
                duration-300
                flex
                items-center
                gap-2
              "
            >
              <ChevronLeft size={18} strokeWidth={3} className="group-hover:-translate-x-1 transition-transform" />
              Anterior
            </button>
          )}
          {/* BOTÓN DE INFORMACIÓN (TOOLTIP / POPOVER) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowInfo(!showInfo)}
              onMouseEnter={() => setShowInfo(true)}
              onMouseLeave={() => setShowInfo(false)}
              className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center hover:bg-blue-100 transition-colors shadow-sm focus:outline-none"
              aria-label="Información de guardado"
            >
              <Info size={20} />
            </button>

            {/* CUADRO FLOTANTE DE INFORMACIÓN (SE ABRE HACIA LA IZQUIERDA/ARRIBA) */}
            {showInfo && (
              <div className="absolute bottom-12 right-0 w-72 sm:w-80 bg-white border border-blue-100 text-slate-700 text-xs p-3.5 rounded-xl shadow-xl z-50 leading-relaxed">
                <div className="font-bold text-blue-900 mb-1 flex items-center gap-1.5">
                  <Info size={14} className="text-blue-600" /> Guardado automático
                </div>
                Tus datos se guardarán al completar este paso. Si cierras la ventana, podrás retomar tu registro cuando quieras con tu documento y el código enviado a tu correo.
              </div>
            )}
          </div>

          {/* BOTÓN PRINCIPAL CON DEGRADADO DORADO CORPORATIVO */}
          <button
            type="button"
            onClick={onNext}
            disabled={isSubmitting}
            className="
              group
              px-8
              py-3
              rounded-xl
              bg-gradient-to-b from-[#EED584] via-[#C5A059] to-[#9E7832]
              text-white
              font-extrabold
              text-sm
              shadow-[0_8px_20px_-6px_rgba(197,160,89,0.6)]
              hover:shadow-[0_12px_25px_-6px_rgba(197,160,89,0.8)]
              hover:-translate-y-0.5
              disabled:opacity-70
              disabled:cursor-not-allowed
              disabled:hover:translate-y-0
              disabled:hover:shadow-[0_8px_20px_-6px_rgba(197,160,89,0.6)]
              transition-all
              duration-300
              flex
              items-center
              gap-2
              border-t border-white/30
            "
          >
            {isSubmitting ? (
              <>
                <svg
                  className="animate-spin h-5 w-5 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Procesando...
              </>
            ) : (
              <>
                <span className="tracking-wide uppercase drop-shadow-sm">{nextLabel}</span>
                <ChevronRight size={18} strokeWidth={3} className="text-white group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}