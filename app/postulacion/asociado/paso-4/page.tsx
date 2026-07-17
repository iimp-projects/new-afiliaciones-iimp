"use client";

import { useRouter } from "next/navigation";
import { useState, ChangeEvent } from "react";
import Link from "next/link";
// IMPORTANTE: Asegúrate de que la ruta coincida con tu Stepper
import Stepper from "@/components/ui/stepper";
import {
  UserCircle2,
  ShieldCheck,
  Users,
  Search,
  FileText,
  Download,
  UploadCloud,
  CheckCircle2,
  Info,
} from "lucide-react";

export default function PasoCuatroPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Estado para previsualización del PDF de la Declaración Jurada
  const [declaracionFile, setDeclaracionFile] = useState<{
    name: string;
    url: string;
    type: string;
  } | null>(null);

  const handleSiguiente = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Navegar al paso 5 (Pago)
    setTimeout(() => {
      // BIEN (borra el historial, no pueden regresar a reenviar)
      router.replace("/postulacion/asociado/paso-5");
    }, 1000);
  };

  const handleAtras = () => {
    router.push("/postulacion/asociado/paso-3");
  };

  // Función para capturar el PDF y generar previsualización
  const handleDeclaracionChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const objectUrl = URL.createObjectURL(file);
      setDeclaracionFile({ name: file.name, url: objectUrl, type: file.type });
    }
  };

  return (
    <div className="w-full min-h-screen bg-[#F7F8FA] relative font-sans antialiased pb-24">
      {/* =========================================
          HERO BACKGROUND PREMIUM 
      ========================================= */}
      <div className="absolute top-0 left-0 w-full h-[650px] bg-gradient-to-br from-[#2a1700] via-[#C5A059]/90 to-[#4a2d00] z-0 overflow-hidden">
        <div
          className="absolute inset-0 z-0 opacity-20 mix-blend-overlay bg-cover bg-center"
          style={{ backgroundImage: "url('/images/minero.jpg')" }}
        ></div>
        <div className="absolute bottom-0 left-0 w-full h-40 bg-gradient-to-t from-[#F7F8FA] to-transparent z-10"></div>
      </div>

      <form
        onSubmit={handleSiguiente}
        className="relative z-20 flex flex-col min-h-screen"
      >
        {/* NAVEGACIÓN */}
        <nav className="w-full px-6 py-6 flex justify-between items-center max-w-5xl mx-auto">
          <img
            src="/images/logo-iimp.png"
            alt="IIMP Logo"
            className="h-12 w-auto brightness-0 invert drop-shadow-md"
          />
          <Link
            href="/login"
            className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm border border-white/20 backdrop-blur-md transition-all flex items-center gap-2 shadow-lg"
          >
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
              Avales y Términos
            </h1>

            <p className="text-lg text-white/90 font-medium">
              Registre a los asociados hábiles que lo presentan y adjunte su
              declaración jurada.
            </p>
          </div>

          {/* ESPACIO DE FORMULARIO */}
          <div className="space-y-8">
            {/* =========================================
                SECCIÓN 1: AVALES
            ========================================= */}
            <section className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-sm">
              {/* HEADER DE LA SECCIÓN */}
              <div className="px-8 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-[#C5A059]/10 flex items-center justify-center">
                    <Users className="w-5 h-5 text-[#C5A059]" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-[#2F3136] tracking-tight">
                      Presentan al Postulante
                    </h2>
                    <p className="text-xs text-gray-500 font-medium">
                      Art° 11 del Estatuto del IIMP: Su solicitud debe estar
                      avalada por 2 asociados activos hábiles.
                    </p>
                  </div>
                </div>
                <div className="hidden sm:flex px-4 py-1.5 rounded-xl bg-[#C5A059]/10 text-[#C5A059] text-xs font-bold uppercase tracking-wider">
                  Requisito
                </div>
              </div>

              <div className="p-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  {/* AVAL 1 */}
                  <div className="p-6 rounded-2xl border border-gray-200 bg-gray-50/30">
                    <h3 className="text-sm font-bold text-[#2F3136] mb-5 border-b border-gray-200 pb-3 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-[#C5A059] text-white flex items-center justify-center text-xs">
                        1
                      </span>
                      Primer Aval
                    </h3>
                    <div className="space-y-5">
                      <div>
                        <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wide">
                          DNI del Aval
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Ingrese DNI"
                            className="w-full h-11 px-3 rounded-xl border border-gray-300 focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/20 focus:outline-none font-medium text-sm text-slate-700 transition-all"
                          />
                          <button
                            type="button"
                            className="h-11 px-4 bg-[#2F3136] hover:bg-black text-white rounded-xl flex items-center justify-center transition-colors"
                          >
                            <Search size={16} />
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wide">
                          Nombre del Aval
                        </label>
                        <input
                          type="text"
                          disabled
                          placeholder="Nombre de aval"
                          className="w-full h-11 px-3 rounded-xl border border-gray-300 bg-gray-100 text-gray-500 font-medium text-sm outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wide">
                          Correo Electrónico
                        </label>
                        <input
                          type="email"
                          disabled
                          placeholder="Correo de aval"
                          className="w-full h-11 px-3 rounded-xl border border-gray-300 bg-gray-100 text-gray-500 font-medium text-sm outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* AVAL 2 */}
                  <div className="p-6 rounded-2xl border border-gray-200 bg-gray-50/30">
                    <h3 className="text-sm font-bold text-[#2F3136] mb-5 border-b border-gray-200 pb-3 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-[#C5A059] text-white flex items-center justify-center text-xs">
                        2
                      </span>
                      Segundo Aval
                    </h3>
                    <div className="space-y-5">
                      <div>
                        <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wide">
                          DNI del Aval
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Ingrese DNI"
                            className="w-full h-11 px-3 rounded-xl border border-gray-300 focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/20 focus:outline-none font-medium text-sm text-slate-700 transition-all"
                          />
                          <button
                            type="button"
                            className="h-11 px-4 bg-[#2F3136] hover:bg-black text-white rounded-xl flex items-center justify-center transition-colors"
                          >
                            <Search size={16} />
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wide">
                          Nombre del Aval
                        </label>
                        <input
                          type="text"
                          disabled
                          placeholder="Nombre de aval"
                          className="w-full h-11 px-3 rounded-xl border border-gray-300 bg-gray-100 text-gray-500 font-medium text-sm outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase tracking-wide">
                          Correo Electrónico
                        </label>
                        <input
                          type="email"
                          disabled
                          placeholder="Correo de aval"
                          className="w-full h-11 px-3 rounded-xl border border-gray-300 bg-gray-100 text-gray-500 font-medium text-sm outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* =========================================
                SECCIÓN 2: DECLARACIÓN JURADA
            ========================================= */}
            <section className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-sm mb-8">
              {/* HEADER DE LA SECCIÓN */}
              <div className="px-8 py-5 border-b border-gray-100 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-[#C5A059]/10 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-[#C5A059]" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[#2F3136] tracking-tight">
                    Solicitud de Afiliación y Declaración Jurada
                  </h2>
                  <p className="text-xs text-gray-500 font-medium">
                    Firme el documento oficial y cárguelo a la plataforma.
                  </p>
                </div>
              </div>

              <div className="p-8">
                {/* CAJA DE INFORMACIÓN (Estilo premium) */}
                <div className="bg-[#FFFDF8] border border-[#E8D09E] rounded-xl p-5 mb-8 flex items-start gap-4">
                  <Info className="w-6 h-6 text-[#C5A059] shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-[#4a2d00] mb-1">
                      Importante
                    </h4>
                    <p className="text-sm text-[#7f561e] leading-relaxed">
                      Haga clic en el botón inferior para generar un documento
                      PDF con los{" "}
                      <strong>
                        datos que acaba de ingresar más la Declaración Jurada
                      </strong>
                      . Revíselo, fírmelo (física o digitalmente) y vuelva a
                      subirlo en el recuadro final.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-8 border-b border-gray-100 pb-8 mb-8">
                  <div className="w-full md:w-1/2">
                    <button
                      type="button"
                      className="w-full h-12 rounded-xl bg-[#C5A059] hover:bg-[#b58f48] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all"
                    >
                      <Download size={18} />
                      Generar y Descargar Documento
                    </button>
                  </div>

                  {/* CHECKBOX DE ACEPTACIÓN */}
                  <div className="w-full md:w-1/2">
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        className="mt-0.5 w-5 h-5 rounded border-gray-300 text-[#C5A059] focus:ring-[#C5A059]"
                      />
                      <span className="text-sm text-gray-600 font-medium group-hover:text-[#2F3136] transition-colors">
                        Declaro haber verificado mis datos y acepto firmar la
                        Solicitud y la Declaración Jurada conforme a ley.
                      </span>
                    </label>
                  </div>
                </div>

                {/* DROPZONE: DECLARACIÓN JURADA PDF */}
                <label className="group cursor-pointer relative overflow-hidden h-[260px] w-full border-2 border-dashed border-gray-300 hover:border-[#C5A059] rounded-2xl p-6 transition-all duration-300 hover:bg-gray-50 flex flex-col items-center justify-center text-center">
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleDeclaracionChange}
                    className="hidden"
                  />

                  {declaracionFile ? (
                    declaracionFile.type === "application/pdf" ? (
                      // SI ES PDF: MOSTRAR IFRAME REAL CON PREVISUALIZACIÓN
                      <div className="w-full h-full absolute inset-0 bg-white flex flex-col items-center justify-center overflow-hidden">
                        <iframe
                          src={`${declaracionFile.url}#toolbar=0&navpanes=0&scrollbar=0`}
                          className="w-full h-full pointer-events-none"
                          title="Declaracion PDF Preview"
                        />

                        {/* Overlay oscuro en hover */}
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-sm cursor-pointer">
                          <span className="bg-white/90 px-4 py-2 rounded-xl text-sm font-bold text-[#2F3136] flex items-center gap-2 shadow-lg">
                            <UploadCloud size={16} /> Cambiar Documento
                          </span>
                        </div>

                        {/* Etiqueta inferior con el nombre */}
                        <div className="absolute bottom-0 left-0 w-full bg-[#2F3136]/90 text-white text-[10px] truncate px-3 py-1.5 text-center font-medium backdrop-blur-md z-10">
                          {declaracionFile.name}
                        </div>
                      </div>
                    ) : (
                      // SI ES OTRO ARCHIVO NO RECONOCIDO
                      <div className="flex flex-col items-center justify-center h-full w-full relative z-10">
                        <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center mb-4 transition-colors">
                          <CheckCircle2 className="w-7 h-7" />
                        </div>
                        <h3 className="text-sm font-bold text-[#2F3136] mb-1">
                          Documento Cargado
                        </h3>
                        <p
                          className="text-xs text-gray-500 mb-4 truncate w-full max-w-[200px]"
                          title={declaracionFile.name}
                        >
                          {declaracionFile.name}
                        </p>
                        <div className="inline-flex items-center gap-2 text-[#C5A059] font-bold text-xs uppercase tracking-wider">
                          <UploadCloud size={16} /> Cambiar Archivo
                        </div>
                      </div>
                    )
                  ) : (
                    // ESTADO POR DEFECTO
                    <>
                      <div className="w-14 h-14 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mb-4 group-hover:bg-[#C5A059]/10 group-hover:text-[#C5A059] transition-colors">
                        <FileText className="w-6 h-6" />
                      </div>
                      <h3 className="text-sm font-bold text-[#2F3136] mb-1">
                        Adjuntar Solicitud Firmada
                      </h3>
                      <p className="text-xs text-gray-500 mb-4 max-w-[200px]">
                        Solo archivos PDF. Peso máximo: 3MB.
                      </p>
                      <div className="inline-flex items-center gap-2 text-[#C5A059] font-bold text-xs uppercase tracking-wider">
                        <UploadCloud size={16} /> Seleccionar Archivo
                      </div>
                    </>
                  )}
                </label>
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
                  <svg
                    className="animate-spin h-4 w-4 text-white"
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
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
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
