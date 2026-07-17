"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
// IMPORTANTE: Misma ruta del Stepper que usamos en el Paso 1
import Stepper from "@/components/ui/stepper"; 
import {
  UserCircle2,
  GraduationCap,
  PlusCircle
} from "lucide-react";

export default function PasoDosPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSiguiente = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Navegar al paso 3
    setTimeout(() => {
        router.push("/postulacion/asociado/paso-3");
    }, 1000);
  };

  const handleAtras = () => {
    router.push("/postulacion/asociado/paso-1");
  };

  return (
    <div className="w-full min-h-screen bg-[#F7F8FA] relative font-sans antialiased pb-24">
      
      {/* =========================================
          HERO BACKGROUND PREMIUM 
      ========================================= */}
      <div className="absolute top-0 left-0 w-full h-[650px] bg-gradient-to-br from-[#2a1700] via-[#C5A059]/90 to-[#4a2d00] z-0 overflow-hidden">
        <div className="absolute inset-0 z-0 opacity-20 mix-blend-overlay bg-cover bg-center" style={{ backgroundImage: "url('/images/minero.jpg')" }}></div>
        <div className="absolute bottom-0 left-0 w-full h-40 bg-gradient-to-t from-[#F7F8FA] to-transparent z-10"></div>
      </div>

      <form onSubmit={handleSiguiente} className="relative z-20 flex flex-col min-h-screen">
        
        {/* NAVEGACIÓN */}
        <nav className="w-full px-6 py-6 flex justify-between items-center max-w-5xl mx-auto">
            <img src="/images/logo-iimp.png" alt="IIMP Logo" className="h-12 w-auto brightness-0 invert drop-shadow-md" />
            <Link href="/login" className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm border border-white/20 backdrop-blur-md transition-all flex items-center gap-2 shadow-lg">
                <UserCircle2 size={18} />
                Iniciar Sesión
            </Link>
        </nav>

        {/* CONTENEDOR PRINCIPAL CENTRADO */}
        <div className="max-w-5xl mx-auto w-full px-4 sm:px-6">
          
          {/* STEPPER COMPONENT INTEGRADO */}
          <div className="w-full mt-10 mb-14">
            <Stepper />
          </div>

          {/* HEADER TEXTOS */}
          <div className="pb-10">
              <div className="flex items-center gap-3 mb-4">
                  <span className="px-3 py-1 rounded-full bg-white/20 border border-white/30 text-white text-xs font-bold uppercase tracking-widest backdrop-blur-sm">
                  Afiliaciones IIMP
                  </span>
                  <span className="px-3 py-1 rounded-full bg-[#FFFDF8] text-[#C5A059] text-xs font-extrabold uppercase tracking-widest shadow-sm">
                  Asociado Activo
                  </span>
              </div>

              <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight drop-shadow-lg mb-4">
                  Formación Académica
              </h1>

              <p className="text-lg text-white/90 font-medium">
                  Registre su historial educativo y colegiatura profesional.
              </p>
          </div>

          {/* ESPACIO DE FORMULARIO */}
          <div className="space-y-8">
            
            {/* SECCIÓN: ESTUDIOS ACADÉMICOS */}
            <section className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-sm">
              
              {/* HEADER DE LA SECCIÓN */}
              <div className="px-8 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[#C5A059]/10 flex items-center justify-center">
                    <GraduationCap className="w-5 h-5 text-[#C5A059]" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-[#2F3136] tracking-tight">Estudios Académicos</h2>
                    <p className="text-xs text-gray-500 font-medium">Ingrese su grado, especialidad y universidad.</p>
                  </div>
                </div>
                <div className="hidden sm:flex px-4 py-1.5 rounded-xl bg-[#C5A059]/10 text-[#C5A059] text-xs font-bold uppercase tracking-wider">
                  Perfil Profesional
                </div>
              </div>

              {/* CUERPO DEL FORMULARIO (Sin iconos en las etiquetas para evitar ruido visual) */}
              <div className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">

                  {/* UNIVERSIDAD */}
                  <div className="xl:col-span-2">
                    <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wide">
                      Universidad / Instituto
                    </label>
                    <select className="w-full h-11 px-3 rounded-xl border border-gray-300 focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/20 focus:outline-none font-medium text-sm text-slate-600 transition-all">
                      <option>Seleccione institución</option>
                      <option>Pontificia Universidad Católica del Perú</option>
                      <option>Universidad Nacional de Ingeniería</option>
                      <option>Universidad de Lima</option>
                      <option>Otra</option>
                    </select>
                  </div>

                  {/* OTRA INSTITUCION */}
                  <div className="xl:col-span-2">
                    <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wide">
                      Otra Institución
                    </label>
                    <input
                      type="text"
                      placeholder="Especifique institución si eligió 'Otra'"
                      className="w-full h-11 px-3 rounded-xl border border-gray-300 focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/20 focus:outline-none font-medium text-sm text-slate-700 transition-all placeholder:text-gray-400"
                    />
                  </div>

                  {/* TITULO */}
                  <div className="xl:col-span-2">
                    <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wide">
                      Título o Diploma
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Título de Ingeniero de Minas"
                      className="w-full h-11 px-3 rounded-xl border border-gray-300 focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/20 focus:outline-none font-medium text-sm text-slate-700 transition-all"
                    />
                  </div>

                  {/* ESPECIALIDAD */}
                  <div className="xl:col-span-2">
                    <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wide">
                      Especialidad
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Metalurgia, Geología..."
                      className="w-full h-11 px-3 rounded-xl border border-gray-300 focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/20 focus:outline-none font-medium text-sm text-slate-700 transition-all"
                    />
                  </div>

                  {/* COLEGIO */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wide">
                      Colegio Profesional
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. CIP"
                      className="w-full h-11 px-3 rounded-xl border border-gray-300 focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/20 focus:outline-none font-medium text-sm text-slate-700 transition-all"
                    />
                  </div>

                  {/* COLEGIATURA */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wide">
                      Nro Colegiatura
                    </label>
                    <input
                      type="text"
                      placeholder="N° de Registro"
                      className="w-full h-11 px-3 rounded-xl border border-gray-300 focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/20 focus:outline-none font-medium text-sm text-slate-700 transition-all"
                    />
                  </div>

                  {/* INGRESO */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wide">
                      Año de Ingreso
                    </label>
                    <input
                      type="number"
                      placeholder="YYYY"
                      className="w-full h-11 px-3 rounded-xl border border-gray-300 focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/20 focus:outline-none font-medium text-sm text-slate-700 transition-all"
                    />
                  </div>

                  {/* EGRESO */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wide">
                      Año de Egreso
                    </label>
                    <input
                      type="number"
                      placeholder="YYYY"
                      className="w-full h-11 px-3 rounded-xl border border-gray-300 focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/20 focus:outline-none font-medium text-sm text-slate-700 transition-all"
                    />
                  </div>

                  {/* TIEMPO SECTOR */}
                  <div className="xl:col-span-4">
                    <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wide">
                      Tiempo en el Sector
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: 10 años laborando en el sector minero"
                      className="w-full h-11 px-3 rounded-xl border border-gray-300 focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/20 focus:outline-none font-medium text-sm text-slate-700 transition-all"
                    />
                  </div>

                </div>

                {/* OBSERVACIONES */}
                <div className="mt-8 pt-8 border-t border-gray-100">
                  <label className="text-xs font-bold text-slate-700 mb-2 block uppercase tracking-wide">
                    Observaciones
                  </label>
                  <textarea
                    rows={3}
                    className="w-full rounded-2xl border border-gray-300 focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/20 focus:outline-none font-medium text-sm text-slate-700 p-4 resize-none transition-all placeholder:text-gray-400"
                    placeholder="Ingrese información adicional o detalles sobre su formación..."
                  />
                </div>

                {/* BOTON AGREGAR */}
                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    className="h-11 px-6 rounded-xl border-2 border-[#C5A059] text-[#C5A059] hover:bg-[#C5A059] hover:text-white font-bold text-sm shadow-sm hover:shadow-md transition-all flex items-center gap-2"
                  >
                    <PlusCircle size={18} />
                    Guardar Estudio
                  </button>
                </div>

              </div>
            </section>

          </div>
        </div>

        {/* FOOTER FIJO DE NAVEGACIÓN */}
        <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 py-4 z-50 shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 flex justify-between items-center">
            
            <button
              type="button"
              onClick={handleAtras}
              className="px-6 py-2.5 rounded-xl border border-gray-300 text-slate-600 font-bold text-sm hover:bg-gray-50 transition-colors"
            >
              Atrás
            </button>

            <button
              type="submit"
              disabled={loading}
              className="px-8 py-2.5 rounded-xl bg-[#2F3136] text-white font-bold text-sm shadow-md hover:bg-black transition-colors disabled:opacity-70 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Guardando...
                </>
              ) : (
                "Guardar y Continuar"
              )}
            </button>

          </div>
        </div>
      </form>
    </div>
  );
}