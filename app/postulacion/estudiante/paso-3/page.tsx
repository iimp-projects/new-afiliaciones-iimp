"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import confetti from "canvas-confetti";
import {
  UserCircle2,
  CheckCircle2,
  Mail,
  ArrowRight,
  Clock,
  ShieldCheck
} from "lucide-react";

export default function PasoTresEstudiantePage() {
  const router = useRouter();

  // Efecto "Yape": Explosión de confetti al cargar la página
  useEffect(() => {
    const duration = 3 * 1000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval: any = setInterval(function () {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      
      // Confetti configurado con la paleta de colores del IIMP
      confetti({
        ...defaults,
        particleCount,
        colors: ['#C5A059', '#E8D09E', '#D6A84A', '#2F3136', '#F7F8FA'],
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      });
      confetti({
        ...defaults,
        particleCount,
        colors: ['#C5A059', '#E8D09E', '#D6A84A', '#2F3136', '#F7F8FA'],
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      });
    }, 250);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full min-h-screen bg-[#F7F8FA] relative font-sans antialiased flex flex-col">
      
      {/* =========================================
          HERO BACKGROUND PREMIUM 
      ========================================= */}
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-[#2a1700] via-[#C5A059]/90 to-[#4a2d00] z-0 overflow-hidden">
        <div className="absolute inset-0 z-0 opacity-20 mix-blend-overlay bg-cover bg-center" style={{ backgroundImage: "url('/images/minero.jpg')" }}></div>
        <div className="absolute bottom-0 left-0 w-full h-[50vh] bg-gradient-to-t from-[#F7F8FA] to-transparent z-10"></div>
      </div>

      <div className="relative z-20 flex flex-col flex-1">
        
        {/* NAVEGACIÓN */}
        <nav className="w-full px-6 py-6 flex justify-between items-center max-w-5xl mx-auto">
            <img src="/images/logo-iimp.png" alt="IIMP Logo" className="h-12 w-auto brightness-0 invert drop-shadow-md" />
            <Link href="/login" className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm border border-white/20 backdrop-blur-md transition-all flex items-center gap-2 shadow-lg">
                <UserCircle2 size={18} />
                Iniciar Sesión
            </Link>
        </nav>

        {/* CONTENEDOR PRINCIPAL - CENTRADO VERTICAL Y HORIZONTAL */}
        <div className="flex-1 flex items-center justify-center p-4 sm:p-6 w-full max-w-3xl mx-auto pb-20">
          
          <section className="bg-white rounded-[32px] border border-gray-200 shadow-2xl overflow-hidden text-center relative w-full mt-4">
            
            {/* Decoración superior sutil */}
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#C5A059] to-[#E8D09E]"></div>

            <div className="p-8 sm:p-16">
              
              {/* Ícono de Éxito Gigante Animado */}
              <div className="mx-auto w-24 h-24 rounded-full bg-emerald-50 border-4 border-emerald-100 flex items-center justify-center mb-8 shadow-sm animate-[bounce_1s_ease-in-out_1]">
                <CheckCircle2 className="w-12 h-12 text-emerald-500" />
              </div>

              <span className="inline-block px-4 py-1.5 rounded-full bg-[#C5A059]/10 text-[#C5A059] text-xs font-bold uppercase tracking-widest mb-4 border border-[#C5A059]/20">
                Postulación Completada
              </span>

              <h1 className="text-3xl md:text-4xl font-black text-[#1E293B] tracking-tight mb-4">
                ¡Felicitaciones, hemos recibido su solicitud!
              </h1>

              <p className="text-lg text-gray-500 font-medium mb-10 max-w-xl mx-auto leading-relaxed">
                Su expediente de postulación como Asociado Estudiante ha sido registrado exitosamente en la plataforma del Instituto de Ingenieros de Minas del Perú.
              </p>

              {/* CAJA DE PRÓXIMOS PASOS (Adaptada para estudiantes) */}
              <div className="bg-[#F7F8FA] border border-gray-200 rounded-2xl p-6 text-left mb-10">
                <h3 className="font-bold text-[#2F3136] mb-4 uppercase tracking-wide text-sm flex items-center gap-2">
                  <Clock size={18} className="text-[#C5A059]" /> 
                  ¿Qué sucede ahora?
                </h3>
                
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                      <ShieldCheck size={12} className="text-[#C5A059]" />
                    </div>
                    <p className="text-sm text-gray-600 font-medium leading-relaxed">
                      Su expediente pasará a una <strong>revisión detallada por nuestro personal administrativo</strong>, quienes validarán su constancia o carta de estudios universitarios.
                    </p>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                      <span className="text-[#C5A059] font-bold text-xs">2</span>
                    </div>
                    <p className="text-sm text-gray-600 font-medium leading-relaxed">
                      Este proceso de evaluación tiene un tiempo estimado de <strong>3 a 5 días hábiles</strong>.
                    </p>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                      <Mail size={12} className="text-[#C5A059]" />
                    </div>
                    <p className="text-sm text-gray-600 font-medium leading-relaxed">
                      Recibirá una notificación oficial en su correo electrónico informándole sobre la <strong>activación de su membresía estudiantil gratuita</strong>.
                    </p>
                  </li>
                </ul>
              </div>

              {/* BOTONES DE ACCIÓN FINAL */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                {/* Al ser el paso final usamos router.push('/') directo, o podríamos usar window.location.href para limpiar todo el stack si es necesario */}
                <button
                  onClick={() => router.push('/')}
                  className="w-full sm:w-auto h-12 px-8 rounded-xl border-2 border-gray-200 text-slate-600 font-bold text-sm hover:bg-gray-50 transition-all flex items-center justify-center"
                >
                  Volver al Inicio
                </button>

                <button
                  onClick={() => router.push('/login')}
                  className="w-full sm:w-auto h-12 px-8 rounded-xl bg-[#C5A059] hover:bg-[#b58f48] text-white font-bold text-sm shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
                >
                  Ir a mi panel <ArrowRight size={18} />
                </button>
              </div>

            </div>
          </section>

        </div>
      </div>
    </div>
  );
}