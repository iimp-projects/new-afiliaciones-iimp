"use client";

import { useRouter } from "next/navigation";
import { useState, ChangeEvent } from "react";
import Link from "next/link";
import Stepper from "@/components/ui/stepper-estudiante"; 
import {
  Fingerprint,
  Search,
  Building2,
  UserCircle2,
  UploadCloud,
  ImageIcon,
  FileText,
  CheckCircle2,
} from "lucide-react";

export default function PasoUnoEstudiantePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [dniFile, setDniFile] = useState<{ name: string; url: string; type: string } | null>(null);

  const handleSiguiente = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // IMPORTANTE: Ruta actualizada para estudiante
    setTimeout(() => {
        router.push("/postulacion/estudiante/paso-2");
    }, 1000);
  };

  const handleFotoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const objectUrl = URL.createObjectURL(file);
      setFotoPreview(objectUrl);
    }
  };

  const handleDniChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const objectUrl = URL.createObjectURL(file);
      setDniFile({ name: file.name, url: objectUrl, type: file.type });
    }
  };

  return (
    <div className="w-full min-h-screen bg-[#F7F8FA] relative font-sans antialiased pb-24">
      
      {/* HERO BACKGROUND PREMIUM */}
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

        {/* CONTENEDOR PRINCIPAL */}
        <div className="max-w-5xl mx-auto w-full px-4 sm:px-6">
          
          <div className="w-full mt-10 mb-14">
            <Stepper />
          </div>

          {/* HEADER TEXTOS (Actualizado a Estudiante) */}
          <div className="pb-10">
              <div className="flex items-center gap-3 mb-4">
                  <span className="px-3 py-1 rounded-full bg-white/20 border border-white/30 text-white text-xs font-bold uppercase tracking-widest backdrop-blur-sm">
                  Afiliaciones IIMP
                  </span>
                  <span className="px-3 py-1 rounded-full bg-[#FFFDF8] text-[#C5A059] text-xs font-extrabold uppercase tracking-widest shadow-sm">
                  Asociado Estudiante
                  </span>
              </div>

              <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight drop-shadow-lg mb-4">
                  Datos Personales
              </h1>

              <p className="text-lg text-white/90 font-medium">
                  Complete la información requerida para iniciar su afiliación como estudiante.
              </p>
          </div>

          <div className="space-y-8">
            
            {/* RENIEC */}
            <section className="bg-[#FCFAF6] rounded-3xl p-6 sm:p-8 shadow-sm border border-[#E8D09E]/50">
              <div className="flex flex-col md:flex-row justify-between md:items-start gap-6 border-b border-[#E8D09E]/30 pb-6 mb-6">
                <div className="flex items-start gap-5">
                  <div className="w-14 h-14 shrink-0 rounded-full border-2 border-[#D6A84A] flex items-center justify-center bg-white shadow-sm">
                    <Fingerprint size={28} className="text-[#C5A059]" />
                  </div>
                  <div>
                    <span className="inline-block px-3 py-1 rounded-full bg-[#F4E9D8] text-[#A67C00] text-[10px] font-bold uppercase tracking-widest mb-2">
                      Integración RENIEC
                    </span>
                    <h2 className="text-2xl font-black text-[#1E293B]">Verificación de Identidad</h2>
                    <p className="text-sm text-gray-500 font-medium mt-1">Consulte automáticamente la información del postulante desde RENIEC.</p>
                  </div>
                </div>

                <div className="hidden md:flex items-center gap-3 opacity-90">
                  <Building2 size={36} className="text-[#C5A059]" />
                  <div>
                    <h3 className="font-black text-[#C5A059] text-2xl leading-none">RENIEC</h3>
                    <p className="text-[9px] text-[#C5A059] font-bold uppercase leading-tight mt-1">
                      Registro Nacional de Identificación<br/>y Estado Civil
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                <div className="md:col-span-4">
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 tracking-wide">Tipo Documento</label>
                  <select className="w-full h-12 rounded-xl border border-gray-300 px-3 text-sm focus:outline-none focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/20 bg-white font-medium text-slate-700">
                    <option>DNI</option>
                    <option>CE</option>
                    <option>Pasaporte</option>
                  </select>
                </div>
                <div className="md:col-span-5">
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 tracking-wide">Número Documento</label>
                  <input
                    type="text"
                    placeholder="Ingrese documento"
                    className="w-full h-12 rounded-xl border border-gray-300 px-3 text-sm focus:outline-none focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/20 font-medium text-slate-700 placeholder:text-gray-400"
                  />
                </div>
                <div className="md:col-span-3 flex items-end">
                  <button
                    type="button"
                    className="w-full h-12 rounded-xl bg-[#D4A353] hover:bg-[#C5A059] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md transition-colors"
                  >
                    <Search size={18} />
                    Buscar Datos
                  </button>
                </div>
              </div>
            </section>

            {/* DATOS PERSONALES */}
            <section className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="px-8 py-5 border-b border-gray-100 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-[#C5A059]/10 flex items-center justify-center">
                  <UserCircle2 className="w-5 h-5 text-[#C5A059]" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[#2F3136] tracking-tight">Información Personal</h2>
                  <p className="text-xs text-gray-500 font-medium">Revise o complete sus datos principales.</p>
                </div>
              </div>

              <div className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                  <div>
                    <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase">Nombres</label>
                    <input type="text" className="w-full h-11 px-3 rounded-xl border border-gray-300 focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/20 focus:outline-none font-medium text-sm text-slate-700 bg-gray-50" disabled />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase">Apellido Paterno</label>
                    <input type="text" className="w-full h-11 px-3 rounded-xl border border-gray-300 focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/20 focus:outline-none font-medium text-sm text-slate-700 bg-gray-50" disabled />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase">Apellido Materno</label>
                    <input type="text" className="w-full h-11 px-3 rounded-xl border border-gray-300 focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/20 focus:outline-none font-medium text-sm text-slate-700 bg-gray-50" disabled />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase">F. de Nacimiento</label>
                    <input type="date" className="w-full h-11 px-3 rounded-xl border border-gray-300 focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/20 focus:outline-none font-medium text-sm text-slate-600" />
                  </div>
                </div>

                {/* CONTACTO */}
                <div className="mt-8 pt-8 border-t border-gray-100">
                  <h3 className="font-bold text-sm text-[#2F3136] uppercase tracking-wide mb-5">Contacto y Género</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                    <div>
                      <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase">Género</label>
                      <select className="w-full h-11 px-3 rounded-xl border border-gray-300 focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/20 focus:outline-none font-medium text-sm text-slate-600">
                        <option>Seleccione</option>
                        <option>Masculino</option>
                        <option>Femenino</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase">Celular</label>
                      <input type="tel" className="w-full h-11 px-3 rounded-xl border border-gray-300 focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/20 focus:outline-none font-medium text-sm text-slate-700" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase">Correo Primario</label>
                      <input type="email" placeholder="ejemplo@correo.com" className="w-full h-11 px-3 rounded-xl border border-gray-300 focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/20 focus:outline-none font-medium text-sm text-slate-700" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase">Correo Secundario</label>
                      <input type="email" placeholder="Opcional" className="w-full h-11 px-3 rounded-xl border border-gray-300 focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/20 focus:outline-none font-medium text-sm text-slate-700" />
                    </div>
                  </div>
                </div>

                {/* UBICACIÓN */}
                <div className="mt-8 pt-8 border-t border-gray-100">
                  <h3 className="font-bold text-sm text-[#2F3136] uppercase tracking-wide mb-5">Ubicación Geográfica</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                    <div>
                      <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase">País</label>
                      <select className="w-full h-11 px-3 rounded-xl border border-gray-300 focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/20 focus:outline-none font-medium text-sm text-slate-600">
                        <option>Perú</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase">Departamento</label>
                      <select className="w-full h-11 px-3 rounded-xl border border-gray-300 focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/20 focus:outline-none font-medium text-sm text-slate-600">
                        <option>Seleccione</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase">Provincia</label>
                      <select className="w-full h-11 px-3 rounded-xl border border-gray-300 focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/20 focus:outline-none font-medium text-sm text-slate-600">
                        <option>Seleccione</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase">Distrito</label>
                      <select className="w-full h-11 px-3 rounded-xl border border-gray-300 focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/20 focus:outline-none font-medium text-sm text-slate-600">
                        <option>Seleccione</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-6">
                    <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase">Dirección Completa</label>
                    <input type="text" placeholder="Ej. Av. Los Canarios 155, Urb. San César..." className="w-full h-11 px-3 rounded-xl border border-gray-300 focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/20 focus:outline-none font-medium text-sm text-slate-700" />
                  </div>
                </div>
              </div>
            </section>

            {/* DOCUMENTOS */}
            <section className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-sm mb-8">
              <div className="px-8 py-5 border-b border-gray-100 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-[#C5A059]/10 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-[#C5A059]" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[#2F3136] tracking-tight">Carga de Documentos</h2>
                  <p className="text-xs text-gray-500 font-medium">Adjunte los documentos obligatorios.</p>
                </div>
              </div>

              <div className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* DROPZONE: FOTO */}
                  <label className="group cursor-pointer relative overflow-hidden h-[260px] w-full border-2 border-dashed border-gray-300 hover:border-[#C5A059] rounded-2xl p-6 transition-all duration-300 hover:bg-gray-50 flex flex-col items-center justify-center text-center">
                    <input type="file" accept="image/png,image/jpeg" onChange={handleFotoChange} className="hidden" />
                    
                    {fotoPreview ? (
                      <div className="w-full h-full absolute inset-0 bg-black/5 flex items-center justify-center">
                        <img src={fotoPreview} alt="Preview" className="w-full h-full object-cover opacity-90 group-hover:opacity-60 transition-opacity" />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-sm cursor-pointer">
                           <span className="bg-white/90 px-4 py-2 rounded-xl text-sm font-bold text-[#2F3136] flex items-center gap-2 shadow-lg">
                             <UploadCloud size={16} /> Cambiar Foto
                           </span>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="w-14 h-14 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mb-4 group-hover:bg-[#C5A059]/10 group-hover:text-[#C5A059] transition-colors">
                          <ImageIcon className="w-6 h-6" />
                        </div>
                        <h3 className="text-sm font-bold text-[#2F3136] mb-1">Fotografía Personal</h3>
                        <p className="text-xs text-gray-500 mb-4 max-w-[200px]">Tamaño carnet o pasaporte, fondo claro y alta resolución.</p>
                        <div className="inline-flex items-center gap-2 text-[#C5A059] font-bold text-xs uppercase tracking-wider">
                          <UploadCloud size={16} /> Seleccionar Archivo
                        </div>
                      </>
                    )}
                  </label>

                  {/* DROPZONE: DNI */}
                  <label className="group cursor-pointer relative overflow-hidden h-[260px] w-full border-2 border-dashed border-gray-300 hover:border-[#C5A059] rounded-2xl p-6 transition-all duration-300 hover:bg-gray-50 flex flex-col items-center justify-center text-center">
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleDniChange} className="hidden" />
                    
                    {dniFile ? (
                       dniFile.type.startsWith('image/') ? (
                         <div className="w-full h-full absolute inset-0 bg-black/5 flex items-center justify-center">
                           <img src={dniFile.url} alt="DNI Preview" className="w-full h-full object-cover opacity-90 group-hover:opacity-60 transition-opacity" />
                           <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-sm cursor-pointer">
                             <span className="bg-white/90 px-4 py-2 rounded-xl text-sm font-bold text-[#2F3136] flex items-center gap-2 shadow-lg">
                               <UploadCloud size={16} /> Cambiar DNI
                             </span>
                           </div>
                           <div className="absolute bottom-0 left-0 w-full bg-[#2F3136]/90 text-white text-[10px] truncate px-3 py-1.5 text-center font-medium backdrop-blur-md">
                             {dniFile.name}
                           </div>
                         </div>
                       ) : dniFile.type === 'application/pdf' ? (
                         <div className="w-full h-full absolute inset-0 bg-white flex flex-col items-center justify-center overflow-hidden">
                           <iframe 
                              src={`${dniFile.url}#toolbar=0&navpanes=0&scrollbar=0`} 
                              className="w-full h-full pointer-events-none" 
                              title="DNI PDF Preview" 
                           />
                           <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-sm cursor-pointer">
                             <span className="bg-white/90 px-4 py-2 rounded-xl text-sm font-bold text-[#2F3136] flex items-center gap-2 shadow-lg">
                               <UploadCloud size={16} /> Cambiar DNI (PDF)
                             </span>
                           </div>
                           <div className="absolute bottom-0 left-0 w-full bg-[#2F3136]/90 text-white text-[10px] truncate px-3 py-1.5 text-center font-medium backdrop-blur-md z-10">
                             {dniFile.name}
                           </div>
                         </div>
                       ) : (
                         <div className="flex flex-col items-center justify-center h-full w-full relative z-10">
                           <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center mb-4 transition-colors">
                             <CheckCircle2 className="w-7 h-7" />
                           </div>
                           <h3 className="text-sm font-bold text-[#2F3136] mb-1">Documento Cargado</h3>
                           <p className="text-xs text-gray-500 mb-4 truncate w-full max-w-[200px]" title={dniFile.name}>{dniFile.name}</p>
                           <div className="inline-flex items-center gap-2 text-[#C5A059] font-bold text-xs uppercase tracking-wider">
                             <UploadCloud size={16} /> Cambiar Archivo
                           </div>
                         </div>
                       )
                    ) : (
                      <>
                        <div className="w-14 h-14 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mb-4 group-hover:bg-[#C5A059]/10 group-hover:text-[#C5A059] transition-colors">
                          <FileText className="w-6 h-6" />
                        </div>
                        <h3 className="text-sm font-bold text-[#2F3136] mb-1">Documento de Identidad</h3>
                        <p className="text-xs text-gray-500 mb-4 max-w-[200px]">Adjunte DNI (ambos lados), CE o Pasaporte vigente.</p>
                        <div className="inline-flex items-center gap-2 text-[#C5A059] font-bold text-xs uppercase tracking-wider">
                          <UploadCloud size={16} /> Seleccionar Archivo
                        </div>
                      </>
                    )}
                  </label>

                </div>
              </div>
            </section>

          </div>
        </div>

        {/* FOOTER FIJO */}
        <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 py-4 z-50 shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 flex justify-between items-center">
            <button
              type="button"
              onClick={() => router.push('/postulacion')}
              className="px-6 py-2.5 rounded-xl border border-gray-300 text-slate-600 font-bold text-sm hover:bg-gray-50 transition-colors"
            >
              Cancelar
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