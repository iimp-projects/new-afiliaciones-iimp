"use client";

import { useEffect, useState, forwardRef, useImperativeHandle } from "react";
import { CheckCircle2, ShieldCheck, Mail, Clock, ArrowRight } from "lucide-react";
import confetti from "canvas-confetti";
import { MembershipType } from "../../Types/MembershipType";

export interface StepRef {
  submit: () => Promise<void>;
}

interface FinishStepProps {
  membershipType: MembershipType;
  trackingCode: string | null;
  saving?: boolean;
  onSubmitApplication(): Promise<void>;
  onNext(): void;
  onBack(): void;
}

const FinishStep = forwardRef<StepRef, FinishStepProps>(
  ({ membershipType, trackingCode, saving = false, onSubmitApplication, onNext, onBack }, ref) => {
    
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Efecto de Confetti al montar la vista de éxito
    useEffect(() => {
      const duration = 3 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };
      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

      const interval: any = setInterval(function () {
        const timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) return clearInterval(interval);

        const particleCount = 50 * (timeLeft / duration);
        confetti({ ...defaults, particleCount, colors: ['#C5A059', '#E8D09E', '#D6A84A', '#2F3136', '#F7F8FA'], origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
        confetti({ ...defaults, particleCount, colors: ['#C5A059', '#E8D09E', '#D6A84A', '#2F3136', '#F7F8FA'], origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
      }, 250);

      return () => clearInterval(interval);
    }, []);

    // Conexión imperativa con el Footer del Orquestador
    useImperativeHandle(ref, () => ({
      submit: async () => {
        setError(null);
        try {
          await onSubmitApplication();
          setSubmitted(true);
          onNext();
        } catch (err: any) {
          setError(err.message || "Ocurrió un error al enviar la postulación.");
        }
      },
    }));

    const isStudent = membershipType === MembershipType.STUDENT;

    return (
      <div className="bg-white rounded-[32px] border border-gray-200 shadow-2xl overflow-hidden text-center relative w-full mt-4">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#C5A059] to-[#E8D09E]"></div>

        <div className="p-8 sm:p-16">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-600 font-bold text-sm">
              {error}
            </div>
          )}

          <div className="mx-auto w-24 h-24 rounded-full bg-emerald-50 border-4 border-emerald-100 flex items-center justify-center mb-8 shadow-sm animate-[bounce_1s_ease-in-out_1]">
            <CheckCircle2 className="w-12 h-12 text-emerald-500" />
          </div>

          <span className="inline-block px-4 py-1.5 rounded-full bg-[#C5A059]/10 text-[#C5A059] text-xs font-bold uppercase tracking-widest mb-4 border border-[#C5A059]/20">
            Postulación Lista para Enviar
          </span>

          <h1 className="text-3xl md:text-4xl font-black text-[#1E293B] tracking-tight mb-4">
            ¡Todo listo para completar su solicitud!
          </h1>

          <p className="text-lg text-gray-500 font-medium mb-10 max-w-xl mx-auto leading-relaxed">
            Haga clic en el botón inferior para procesar y enviar oficialmente su expediente como <strong>{isStudent ? "Asociado Estudiante" : "Asociado Activo"}</strong> al Instituto de Ingenieros de Minas del Perú.
          </p>

          <div className="bg-[#F7F8FA] border border-gray-200 rounded-2xl p-6 text-left mb-10">
            <h3 className="font-bold text-[#2F3136] mb-4 uppercase tracking-wide text-sm flex items-center gap-2">
              <Clock size={18} className="text-[#C5A059]" /> 
              ¿Qué sucederá después de enviar?
            </h3>
            
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                  <ShieldCheck size={12} className="text-[#C5A059]" />
                </div>
                <p className="text-sm text-gray-600 font-medium leading-relaxed">
                  Su expediente pasará a una <strong>revisión detallada por nuestro personal administrativo</strong>.
                </p>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                  <span className="text-[#C5A059] font-bold text-xs">2</span>
                </div>
                <p className="text-sm text-gray-600 font-medium leading-relaxed">
                  El tiempo estimado de evaluación es de <strong>3 a 5 días hábiles</strong>.
                </p>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                  <Mail size={12} className="text-[#C5A059]" />
                </div>
                <p className="text-sm text-gray-600 font-medium leading-relaxed">
                  Recibirá las instrucciones de activación o pago directamente en su correo electrónico principal.
                </p>
              </li>
            </ul>
          </div>

          {trackingCode && (
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">
              Código de Seguimiento: <span className="text-[#C5A059]">{trackingCode}</span>
            </p>
          )}

        </div>
      </div>
    );
  }
);

FinishStep.displayName = "FinishStep";

export default FinishStep;