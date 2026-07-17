"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
// IMPORTANTE: Misma ruta del Stepper
import Stepper from "@/components/ui/stepper"; 
import {
  UserCircle2,
  Briefcase,
  UserCheck,
  PlusCircle
} from "lucide-react";

export default function PasoTresPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSiguiente = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Navegar al paso 4
    setTimeout(() => {
        router.push("/postulacion/asociado/paso-4");
    }, 1000);
  };

  const handleAtras = () => {
    router.push("/postulacion/asociado/paso-2");
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
                  Experiencia Laboral
              </h1>

              <p className="text-lg text-white/90 font-medium">
                  Registre la información de su centro de trabajo actual o último empleo.
              </p>
          </div>

          {/* ESPACIO DE FORMULARIO */}
          <div className="space-y-8">
            
            {/* SECCIÓN: CENTRO DE TRABAJO */}
            <section className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-sm">
              
              {/* HEADER DE LA SECCIÓN */}
              <div className="px-8 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[#C5A059]/10 flex items-center justify-center">
                    <Briefcase className="w-5 h-5 text-[#C5A059]" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-[#2F3136] tracking-tight">Centro de Trabajo</h2>
                    <p className="text-xs text-gray-500 font-medium">Complete los datos de la institución o empresa.</p>
                  </div>
                </div>
                <div className="hidden sm:flex px-4 py-1.5 rounded-xl bg-[#C5A059]/10 text-[#C5A059] text-xs font-bold uppercase tracking-wider">
                  Perfil Laboral
                </div>
              </div>

              {/* CUERPO DEL FORMULARIO */}
              <div className="p-8">
                
                {/* OPCIONES DE ESTADO LABORAL */}
                <div className="grid md:grid-cols-2 gap-5 mb-8 border-b border-gray-100 pb-8">
                  
                  <label className="flex items-center gap-4 p-4 rounded-xl border-2 border-gray-200 hover:border-[#C5A059] bg-gray-50/50 hover:bg-white cursor-pointer transition-all">
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 rounded border-gray-300 text-[#C5A059] focus:ring-[#C5A059]"
                    />
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center">
                        <UserCheck size={16} className="text-[#C5A059]" />
                      </div>
                      <span className="font-bold text-sm text-[#2F3136]">
                        Profesional Independiente
                      </span>
                    </div>
                  </label>

                  <label className="flex items-center gap-4 p-4 rounded-xl border-2 border-gray-200 hover:border-[#C5A059] bg-gray-50/50 hover:bg-white cursor-pointer transition-all">
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 rounded border-gray-300 text-[#C5A059] focus:ring-[#C5A059]"
                    />
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center">
                        <Briefcase size={16} className="text-slate-500" />
                      </div>
                      <span className="font-bold text-sm text-[#2F3136]">
                        Actualmente no laboro
                      </span>
                    </div>
                  </label>

                </div>

                {/* GRID DE INPUTS */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">

                  {/* EMPRESA */}
                  <div className="xl:col-span-2">
                    <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wide">
                      Empresa o Institución
                    </label>
                    <input
                      type="text"
                      placeholder="Nombre de la empresa"
                      className="w-full h-11 px-3 rounded-xl border border-gray-300 focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/20 focus:outline-none font-medium text-sm text-slate-700 transition-all"
                    />
                  </div>

                  {/* AREA */}
                  <div className="xl:col-span-2">
                    <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wide">
                      Área o Departamento
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Gerencia de Operaciones"
                      className="w-full h-11 px-3 rounded-xl border border-gray-300 focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/20 focus:outline-none font-medium text-sm text-slate-700 transition-all"
                    />
                  </div>

                  {/* CARGO */}
                  <div className="xl:col-span-2">
                    <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wide">
                      Cargo
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Ingeniero Senior"
                      className="w-full h-11 px-3 rounded-xl border border-gray-300 focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/20 focus:outline-none font-medium text-sm text-slate-700 transition-all"
                    />
                  </div>

                  {/* RUC */}
                  <div className="xl:col-span-2">
                    <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wide">
                      RUC
                    </label>
                    <input
                      type="text"
                      placeholder="RUC de la empresa"
                      className="w-full h-11 px-3 rounded-xl border border-gray-300 focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/20 focus:outline-none font-medium text-sm text-slate-700 transition-all"
                    />
                  </div>

                  {/* TELEFONO */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wide">
                      Teléfono
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. (01) 123-4567"
                      className="w-full h-11 px-3 rounded-xl border border-gray-300 focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/20 focus:outline-none font-medium text-sm text-slate-700 transition-all"
                    />
                  </div>

                  {/* ANEXO */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wide">
                      Anexo <span className="text-gray-400 font-normal capitalize">(Opcional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. 101"
                      className="w-full h-11 px-3 rounded-xl border border-gray-300 focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/20 focus:outline-none font-medium text-sm text-slate-700 transition-all"
                    />
                  </div>

                  {/* CORREO */}
                  <div className="xl:col-span-2">
                    <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wide">
                      Correo Corporativo
                    </label>
                    <input
                      type="email"
                      placeholder="nombre@empresa.com"
                      className="w-full h-11 px-3 rounded-xl border border-gray-300 focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/20 focus:outline-none font-medium text-sm text-slate-700 transition-all"
                    />
                  </div>

                  {/* DIRECCION */}
                  <div className="xl:col-span-4">
                    <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wide">
                      Dirección de la Empresa
                    </label>
                    <input
                      type="text"
                      placeholder="Dirección exacta de la oficina o planta"
                      className="w-full h-11 px-3 rounded-xl border border-gray-300 focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/20 focus:outline-none font-medium text-sm text-slate-700 transition-all"
                    />
                  </div>

                </div>

                {/* BOTON AGREGAR EXPERIENCIA (Estilo secundario) */}
                <div className="mt-8 flex justify-end pt-6 border-t border-gray-100">
                  <button
                    type="button"
                    className="h-11 px-6 rounded-xl border-2 border-[#C5A059] text-[#C5A059] hover:bg-[#C5A059] hover:text-white font-bold text-sm shadow-sm hover:shadow-md transition-all flex items-center gap-2"
                  >
                    <PlusCircle size={18} />
                    Agregar Experiencia
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