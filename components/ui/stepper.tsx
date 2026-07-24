"use client";

import { usePathname } from "next/navigation";
import {
  User,
  GraduationCap,
  Briefcase,
  ShieldCheck,
  Check,
  CheckCircle2, // Cambiado: Ícono de finalización en lugar de tarjeta
} from "lucide-react";

// CORRECCIÓN: Último paso actualizado a FINALIZACIÓN
const PASOS = [
  {
    id: 1,
    name: "DATOS PERSONALES",
    path: "paso-1", 
    icon: User,
  },
  {
    id: 2,
    name: "FORMACIÓN ACADÉMICA",
    path: "paso-2",
    icon: GraduationCap,
  },
  {
    id: 3,
    name: "EXPERIENCIA LABORAL",
    path: "paso-3",
    icon: Briefcase,
  },
  {
    id: 4,
    name: "AVALES Y TÉRMINOS",
    path: "paso-4",
    icon: ShieldCheck,
  },
  {
    id: 5,
    name: "FINALIZACIÓN", // Cambiado de PAGO a FINALIZACIÓN
    path: "paso-5",
    icon: CheckCircle2,
  },
];

export default function Stepper() {
  const pathname = usePathname();

  // Encuentra correctamente en qué paso estamos
  const pasoActual = PASOS.find((p) => pathname.includes(p.path))?.id || 1;

  // Cálculo de la barra de progreso
  const progreso = ((pasoActual - 1) / (PASOS.length - 1)) * 100;

  return (
    <div className="w-full">
      {/* ================= MOBILE ================= */}
      <div className="md:hidden space-y-3">
        {PASOS.map((paso) => {
          const Icon = paso.icon;
          const active = paso.id === pasoActual;
          const completed = paso.id < pasoActual;

          return (
            <div
              key={paso.id}
              className={`
                flex
                items-center
                gap-4
                rounded-2xl
                px-4
                py-4
                transition-all
                ${
                  active
                    ? "bg-white text-[#C5A059] shadow-xl"
                    : completed
                      ? "bg-emerald-500 text-white"
                      : "bg-white/10 backdrop-blur-md text-white"
                }
              `}
            >
              <div
                className="
                  w-12
                  h-12
                  rounded-xl
                  flex
                  items-center
                  justify-center
                  bg-black/5
                "
              >
                {completed ? <Check size={20} /> : <Icon size={20} />}
              </div>

              <div className="flex-1">
                <p className="text-xs uppercase opacity-70">Paso {paso.id}</p>
                <p className="font-semibold">{paso.name}</p>
              </div>

              {active && (
                <span
                  className="
                    px-2
                    py-1
                    rounded-full
                    text-[10px]
                    font-bold
                    bg-[#C5A059]
                    text-white
                  "
                >
                  ACTUAL
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* ================= DESKTOP ================= */}
      <div className="hidden md:block relative">
        {/* Barra de progreso de fondo */}
        <div className="absolute top-8 left-0 w-full h-[3px] bg-white/20 rounded-full" />

        {/* Barra de progreso activa */}
        <div
          className="absolute top-8 left-0 h-[3px] bg-white rounded-full transition-all duration-700"
          style={{
            width: `${progreso}%`,
          }}
        />

        <div className="grid grid-cols-5 gap-4 lg:gap-6 relative">
          {PASOS.map((paso) => {
            const Icon = paso.icon;
            const active = paso.id === pasoActual;
            const completed = paso.id < pasoActual;

            return (
              <div
                key={paso.id}
                className="relative flex flex-col items-center text-center"
              >
                {/* Badge de "Actual" */}
                {active && (
                  <div
                    className="
                      absolute
                      -top-10
                      left-1/2
                      -translate-x-1/2
                      px-3
                      py-1
                      rounded-full
                      bg-white
                      text-[#C5A059]
                      text-[10px]
                      font-bold
                      shadow-lg
                      uppercase
                    "
                  >
                    Actual
                  </div>
                )}

                {/* Efecto de pulso para el actual */}
                {active && (
                  <div
                    className="
                      absolute
                      top-0
                      w-16
                      h-16
                      bg-white
                      opacity-40
                      blur-2xl
                      rounded-2xl
                      animate-pulse
                    "
                  />
                )}

                {/* Ícono Principal */}
                <div
                  className={`
                    relative z-10
                    w-16
                    h-16
                    rounded-2xl
                    flex
                    items-center
                    justify-center
                    transition-all
                    duration-500
                    ${
                      active
                        ? `
                          bg-white
                          text-[#C5A059]
                          scale-110
                          shadow-[0_15px_40px_rgba(255,255,255,0.35)]
                        `
                        : completed
                          ? `
                          bg-emerald-500
                          text-white
                          shadow-lg
                        `
                          : `
                          bg-white/10
                          backdrop-blur-md
                          border
                          border-white/20
                          text-white
                        `
                    }
                  `}
                >
                  {completed ? (
                    <Check size={24} strokeWidth={3} />
                  ) : (
                    <Icon size={24} />
                  )}
                </div>

                {/* Subtítulo Paso */}
                <span
                  className={`
                    mt-4
                    text-[11px]
                    uppercase
                    tracking-[0.15em]
                    font-semibold
                    ${active ? "text-white" : "text-white/60"}
                  `}
                >
                  Paso {paso.id}
                </span>

                {/* Nombre del Paso */}
                <span
                  className={`
                    mt-1
                    text-sm
                    font-bold
                    leading-tight
                    max-w-[150px]
                    ${active ? "text-white" : "text-white/80"}
                  `}
                >
                  {paso.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}