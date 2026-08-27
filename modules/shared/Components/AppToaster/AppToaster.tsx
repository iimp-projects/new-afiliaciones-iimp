"use client";

import { Toaster } from "sonner"; 
import { CheckCircle2, XCircle, AlertTriangle, Info } from "lucide-react"; 

export function AppToaster() {
    return (
        <>
            {/* ✅ ANIMACIÓN DE LA BARRA DE PROGRESO INFERIOR */}
            <style dangerouslySetInnerHTML={{__html: `
                @keyframes toastProgress {
                    0% { width: 100%; }
                    100% { width: 0%; }
                }
                
                .toast-modern::after {
                    content: '';
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    height: 3px;
                    border-bottom-left-radius: 12px;
                    animation: toastProgress 4000ms linear forwards; 
                }

                /* Colores de la barra animada para cada estado */
                .toast-modern[data-type="success"]::after { background-color: #10b981; } /* emerald-500 */
                .toast-modern[data-type="error"]::after { background-color: #ef4444; }   /* red-500 */
                .toast-modern[data-type="warning"]::after { background-color: #f59e0b; } /* amber-500 */
                .toast-modern[data-type="info"]::after { background-color: #3b82f6; }    /* blue-500 */
            `}} />

            <Toaster 
                position="top-right" // ✅ ARRIBA A LA DERECHA (Súper visible pero no estorba)
                duration={4000} 
                offset="24px" 
                toastOptions={{
                    className: "!toast-modern !relative !flex !items-start !gap-3 !w-full sm:!w-[360px] !p-4 !rounded-[12px] !border !shadow-[0_8px_30px_-10px_rgba(0,0,0,0.15)] !overflow-hidden font-sans",
                    classNames: {
                        content: "!flex-1 !min-w-0",
                        title: "!font-bold !text-[14px] !leading-tight",
                        description: "!font-medium !text-[13px] !mt-1 !leading-snug !line-clamp-2 !opacity-90",
                        
                        // ✅ FONDOS DE COLORES SUAVES Y ELEGANTES (Verde suave para éxito)
                        success: "!bg-emerald-50 !border-emerald-200 !text-emerald-900",
                        error: "!bg-red-50 !border-red-200 !text-red-900",
                        warning: "!bg-amber-50 !border-amber-200 !text-amber-900",
                        info: "!bg-blue-50 !border-blue-200 !text-blue-900",
                    }
                }}
                icons={{
                    // ✅ ÍCONOS CON FONDO BLANCO (Para que resalten hermoso sobre el fondo de color suave)
                    success: <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm"><CheckCircle2 size={16} className="text-emerald-500" strokeWidth={3} /></div>,
                    error: <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm"><XCircle size={16} className="text-red-500" strokeWidth={3} /></div>,
                    warning: <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm"><AlertTriangle size={16} className="text-amber-500" strokeWidth={3} /></div>,
                    info: <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm"><Info size={16} className="text-blue-500" strokeWidth={3} /></div>,
                }}
            />
        </>
    );
}