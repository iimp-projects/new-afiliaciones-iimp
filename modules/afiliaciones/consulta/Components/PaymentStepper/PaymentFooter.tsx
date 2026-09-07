"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";

interface Props {
  currentStep: number;
  onCancel: () => void;
  onPrevious: () => void;
  onNext: () => void;
  isNextDisabled: boolean;
  loading: boolean;
}

export default function PaymentFooter({ currentStep, onCancel, onPrevious, onNext, isNextDisabled, loading }: Props) {
  if (currentStep === 3) {
    return <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 py-4 z-[100] shadow-[0_-10px_30px_rgba(0,0,0,0.05)]"><div className="max-w-5xl mx-auto px-4 sm:px-6 flex justify-end"><button onClick={onPrevious} disabled={loading} className="px-6 py-3 rounded-xl border-2 border-gray-200 font-bold text-sm disabled:opacity-50 flex items-center gap-2"><ChevronLeft size={18} />Anterior</button></div></div>;
  }

  return <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 py-4 z-[100] shadow-[0_-10px_30px_rgba(0,0,0,0.05)]"><div className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center justify-between">
    <button onClick={onCancel} disabled={loading} className="px-5 py-3 rounded-xl text-slate-400 font-bold text-sm disabled:opacity-50 flex items-center gap-2"><X size={18} />Cancelar y cerrar</button>
    <div className="flex items-center gap-4">{currentStep > 1 && <button onClick={onPrevious} disabled={loading} className="px-6 py-3 rounded-xl border-2 border-gray-200 font-bold text-sm disabled:opacity-50 flex items-center gap-2"><ChevronLeft size={18} />Anterior</button>}
    <button disabled={isNextDisabled || loading} onClick={onNext} className="px-8 py-3 rounded-xl bg-[#C5A059] text-white font-extrabold text-sm disabled:opacity-50 flex items-center gap-2">Siguiente <ChevronRight size={18} /></button></div>
  </div></div>;
}
