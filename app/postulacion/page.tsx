"use client";

import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Users,
  Ticket,
  Coffee,
  CheckCircle2,
  Award,
  ChevronDown,
  FileText,
} from "lucide-react";

export default function PostulacionLandingPage() {
  // Función para hacer scroll suave a los planes
  const scrollToPlanes = () => {
    document
      .getElementById("planes-afiliacion")
      ?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <main className="min-h-screen bg-surface font-sans antialiased">
      {/* =========================================
                1. HERO SECTION (El Gancho)
            ========================================= */}
      <section className="relative min-h-[90vh] flex flex-col justify-center overflow-hidden bg-primary">
        {/* Background Premium */}
        <div className="absolute inset-0 z-0 bg-gradient-to-br from-[#2a1700] via-primary to-primary-container opacity-95"></div>
        <div
          className="absolute inset-0 z-0 opacity-20 mix-blend-overlay bg-cover bg-center"
          style={{ backgroundImage: "url('/images/minero.jpg')" }}
        ></div>
        <div className="absolute bottom-0 left-0 w-full h-40 bg-gradient-to-t from-surface to-transparent z-10"></div>

        {/* Navbar Superior */}
        <nav className="absolute top-0 left-0 w-full p-6 md:px-12 z-20 flex justify-between items-center">
          <img
            src="/images/logo-iimp.png"
            alt="IIMP Logo"
            className="h-12 w-auto brightness-0 invert"
          />
          <Link
            href="/login"
            className="text-white/80 hover:text-white font-bold text-sm transition-colors"
          >
            Ya soy asociado →
          </Link>
        </nav>

        <div className="relative z-20 w-full max-w-[1280px] mx-auto px-6 lg:px-12 text-center mt-12">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-xs font-bold uppercase tracking-widest text-[#f3bd7a] mb-6 backdrop-blur-sm">
            Comunidad Oficial
          </span>

          <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold mb-6 leading-[1.1] tracking-tight text-white drop-shadow-xl max-w-4xl mx-auto">
            Eleva tu carrera a la <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#f3bd7a] to-white">
              élite de la minería
            </span>
          </h1>

          <p className="text-lg md:text-xl mb-10 text-white/80 font-medium max-w-2xl mx-auto leading-relaxed">
            Conecta con los líderes del sector, accede a conocimiento de clase
            mundial y asegura tarifas exclusivas en los eventos más importantes
            del país.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={scrollToPlanes}
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-[#f3bd7a] to-[#c39254] text-[#2a1700] font-extrabold text-sm uppercase tracking-widest hover:scale-105 hover:shadow-[0_10px_25px_rgba(243,189,122,0.3)] transition-all duration-300"
            >
              Ver planes de afiliación
            </button>
            <p className="text-sm text-white/60 font-medium sm:ml-4">
              Inversión con retorno garantizado.
            </p>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20 animate-bounce text-white/50">
          <ChevronDown size={32} strokeWidth={1.5} />
        </div>
      </section>

      {/* =========================================
        2. BENEFICIOS PREMIUM (Showcase Tecnológico)
      ========================================= */}
      <section className="py-24 px-6 lg:px-12 bg-[#F8F9FA] relative z-20 overflow-hidden">
        {/* Decoraciones de fondo (Tech Vibe) */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-[#c39254]/10 rounded-full blur-[120px] translate-y-1/2 -translate-x-1/3 pointer-events-none"></div>

        <div className="max-w-[1280px] mx-auto relative z-10">
          
          {/* Cabecera Descriptiva */}
          <div className="text-center mb-20">
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-primary/20 text-primary text-sm font-extrabold uppercase tracking-widest mb-6 shadow-sm">
              <Award size={18} /> Beneficios Exclusivos
            </span>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-black text-[#1E293B] tracking-tight mb-6 leading-tight">
              Tu acceso directo a la <br className="hidden md:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#D6A84A] to-[#8C6215]">
                excelencia minera
              </span>
            </h2>
            <p className="text-lg md:text-xl text-slate-500 max-w-3xl mx-auto leading-relaxed font-medium">
              Diseñado para profesionales que exigen lo mejor. Multiplica tu inversión con accesos liberados, herramientas globales y la red de contactos más influyente del país.
            </p>
          </div>

          {/* FEATURE 1: El Video Cinemático (Sin recortes, formato panorámico) */}
          <div className="w-full bg-white rounded-[32px] border border-gray-200 shadow-xl overflow-hidden mb-10 flex flex-col xl:flex-row group hover:shadow-2xl hover:border-primary/40 transition-all duration-500">
            
            {/* Contenedor del Video (Proporción perfecta 16:9) */}
            <div className="w-full xl:w-[60%] bg-black relative aspect-video xl:aspect-auto">
              <video
                autoPlay
                loop
                muted
                playsInline
                className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity duration-700"
              >
                {/* Ruta de tu video local */}
                <source src="/videos/jueves_minero.mp4" type="video/mp4" />
                Tu navegador no soporta videos.
              </video>
              
              {/* Overlay y Botón Play visual */}
              <div className="absolute inset-0 bg-gradient-to-t xl:bg-gradient-to-r from-black/80 via-black/20 to-transparent"></div>
              <div className="absolute bottom-8 left-8 xl:bottom-12 xl:left-12 flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center text-white shadow-[0_0_30px_rgba(197,160,89,0.8)] animate-pulse">
                  <svg className="w-6 h-6 ml-1" fill="currentColor" viewBox="0 0 20 20"><path d="M4 4l12 6-12 6z"/></svg>
                </div>
                <div>
                  <span className="block text-white font-black tracking-widest uppercase text-sm">Experiencia IIMP</span>
                  <span className="block text-white/70 text-xs mt-1">Conecta con los líderes</span>
                </div>
              </div>
            </div>

            {/* Contenido Descriptivo del Video */}
            <div className="w-full xl:w-[40%] p-8 lg:p-12 flex flex-col justify-center bg-white">
              <div className="w-16 h-16 rounded-2xl bg-[#D6A84A]/10 text-[#D6A84A] flex items-center justify-center mb-6">
                <Coffee size={32} strokeWidth={1.5} />
              </div>
              <h3 className="text-3xl font-extrabold text-[#1E293B] mb-4">Networking de Alto Nivel</h3>
              <p className="text-lg text-slate-500 leading-relaxed mb-8">
                Construye relaciones que transforman carreras. Disfruta de participación preferencial en los <strong className="text-[#1E293B]">Jueves Mineros presenciales</strong>, y accede junto a tus invitados al exclusivo Restobar Minero y Salas VIP en nuestra sede.
              </p>
              <ul className="space-y-4">
                <li className="flex items-center gap-3 text-sm font-bold text-slate-700">
                  <CheckCircle2 className="text-[#D6A84A] w-6 h-6 shrink-0"/> Intercambio de ideas con expertos
                </li>
                <li className="flex items-center gap-3 text-sm font-bold text-slate-700">
                  <CheckCircle2 className="text-[#D6A84A] w-6 h-6 shrink-0"/> Ambientes de negocios exclusivos
                </li>
              </ul>
            </div>
          </div>

          {/* GRID INFERIOR (3 Tarjetas de alto nivel y muy descriptivas) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* Tarjeta OneMine */}
            <div className="bg-white p-8 lg:p-10 rounded-[32px] border border-gray-200 shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-40 h-40 bg-[#D6A84A]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-[#D6A84A]/20 transition-colors"></div>
              <div className="w-16 h-16 rounded-2xl bg-[#F8F9FA] border border-gray-100 text-[#D6A84A] flex items-center justify-center mb-8 shadow-sm group-hover:scale-110 transition-transform">
                <BookOpen size={32} strokeWidth={1.5} />
              </div>
              <h3 className="text-2xl font-black text-[#1E293B] mb-4">OneMine Global</h3>
              <p className="text-slate-500 leading-relaxed mb-6 font-medium">
                Accede sin límites a la biblioteca virtual minera más grande del mundo. Más de <strong className="text-[#D6A84A]">120,000 publicaciones técnicas</strong> de la industria a tu entera disposición.
              </p>
              <span className="inline-flex items-center gap-2 text-sm font-bold text-[#D6A84A] group-hover:gap-3 transition-all">
                Conocimiento ilimitado <ArrowRight size={16} />
              </span>
            </div>

            {/* Tarjeta Eventos */}
            <div className="bg-white p-8 lg:p-10 rounded-[32px] border border-gray-200 shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-40 h-40 bg-[#8C6215]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-[#8C6215]/20 transition-colors"></div>
              <div className="w-16 h-16 rounded-2xl bg-[#F8F9FA] border border-gray-100 text-[#8C6215] flex items-center justify-center mb-8 shadow-sm group-hover:scale-110 transition-transform">
                <Ticket size={32} strokeWidth={1.5} />
              </div>
              <h3 className="text-2xl font-black text-[#1E293B] mb-4">Eventos Top</h3>
              <p className="text-slate-500 leading-relaxed mb-6 font-medium">
                Tarifas preferenciales que amortizan tu membresía al instante. Descuentos significativos en tu inscripción a <strong className="text-[#8C6215]">PERUMIN y proEXPLO</strong>.
              </p>
              <span className="inline-flex items-center gap-2 text-sm font-bold text-[#8C6215] group-hover:gap-3 transition-all">
                Descubre los eventos <ArrowRight size={16} />
              </span>
            </div>

            {/* Tarjeta Desarrollo / Mentoring */}
            <div className="bg-white p-8 lg:p-10 rounded-[32px] border border-gray-200 shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-40 h-40 bg-[#2F3136]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-[#2F3136]/20 transition-colors"></div>
              <div className="w-16 h-16 rounded-2xl bg-[#F8F9FA] border border-gray-100 text-[#2F3136] flex items-center justify-center mb-8 shadow-sm group-hover:scale-110 transition-transform">
                <Award size={32} strokeWidth={1.5} />
              </div>
              <h3 className="text-2xl font-black text-[#1E293B] mb-4">Desarrollo Profesional</h3>
              <p className="text-slate-500 leading-relaxed mb-6 font-medium">
                Descuentos en cursos especializados, envío mensual de la Revista Minería y oportunidad de participar como mentor en el programa <strong className="text-[#2F3136]">Mentoring</strong>.
              </p>
              <span className="inline-flex items-center gap-2 text-sm font-bold text-[#2F3136] group-hover:gap-3 transition-all">
                Impulsa tu perfil <ArrowRight size={16} />
              </span>
            </div>

          </div>
        </div>
      </section>

      {/* =========================================
                3. PRUEBA SOCIAL (Testimonios y Stats)
            ========================================= */}
      <section className="py-24 bg-surface relative overflow-hidden border-y border-outline-variant">
        {/* Decoración de fondo sutil */}
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>

        <div className="max-w-[1280px] mx-auto px-6 lg:px-12 relative z-10">
          {/* Header y Stats Integrados */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-10 mb-16">
            <div className="max-w-xl text-center md:text-left">
              <h2 className="text-3xl md:text-4xl font-extrabold text-on-surface mb-4">
                Respaldados por la{" "}
                <span className="text-primary">industria</span>
              </h2>
              <p className="text-lg text-secondary">
                Únete a la red de profesionales mineros más influyente de la
                región. El éxito de nuestros asociados es nuestra mejor
                garantía.
              </p>
            </div>

            <div className="flex items-center gap-8 bg-surface-container-lowest px-8 py-5 rounded-2xl border border-secondary/10 shadow-sm">
              <div className="flex flex-col text-center md:text-left">
                <span className="text-3xl font-black text-on-surface">
                  +10K
                </span>
                <span className="text-xs font-bold text-secondary uppercase tracking-wider">
                  Asociados
                </span>
              </div>
              <div className="w-px h-12 bg-outline-variant"></div>
              <div className="flex flex-col text-center md:text-left">
                <span className="text-3xl font-black text-on-surface">
                  80K+
                </span>
                <span className="text-xs font-bold text-secondary uppercase tracking-wider">
                  Lectores
                </span>
              </div>
            </div>
          </div>

          {/* Grid de Testimonios */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Testimonio 1: Enfoque Senior / OneMine */}
            <div className="bg-surface-container-lowest p-8 rounded-3xl border border-secondary/10 shadow-[0_10px_30px_-15px_rgba(0,0,0,0.05)] hover:-translate-y-1 transition-transform flex flex-col justify-between">
              <div>
                <div className="flex text-[#f3bd7a] mb-5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <svg
                      key={star}
                      className="w-5 h-5 fill-current"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className="text-on-surface-variant font-medium leading-relaxed mb-8 italic">
                  "Gracias al acceso ilimitado a OneMine, mi equipo redujo el
                  tiempo de investigación a la mitad. Es una herramienta
                  invaluable que justifica la membresía por sí sola."
                </p>
              </div>
              <div className="flex items-center gap-4">
                <img
                  src="https://randomuser.me/api/portraits/men/32.jpg"
                  alt="Carlos Mendoza"
                  className="w-12 h-12 rounded-full object-cover border-2 border-primary/20"
                />
                <div>
                  <h4 className="font-bold text-on-surface text-sm">
                    Carlos Mendoza
                  </h4>
                  <p className="text-xs text-secondary">Geólogo Senior</p>
                </div>
              </div>
            </div>

            {/* Testimonio 2: Tarjeta Invertida Premium / Enfoque Networking y Proyectos */}
            <div className="bg-primary p-8 rounded-3xl shadow-[0_20px_40px_-15px_rgba(127,86,30,0.3)] hover:-translate-y-1 transition-transform relative overflow-hidden text-white flex flex-col justify-between">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
              <div className="relative z-10">
                <div className="flex text-white mb-5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <svg
                      key={star}
                      className="w-5 h-5 fill-current"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className="font-medium leading-relaxed mb-8 italic text-white/90">
                  "El networking digital y presencial que logré a través del
                  IIMP me permitió conectar con líderes de la industria y
                  potenciar proyectos tecnológicos críticos para eventos como
                  proEXPLO."
                </p>
              </div>
              <div className="flex items-center gap-4 relative z-10">
                <img
                  src="https://randomuser.me/api/portraits/men/46.jpg"
                  alt="Max Ichajaya"
                  className="w-12 h-12 rounded-full object-cover border-2 border-white/30"
                />
                <div>
                  <h4 className="font-bold text-white text-sm">John Moron</h4>
                  <p className="text-xs text-white/70">
                    Desarrollador de Software
                  </p>
                </div>
              </div>
            </div>

            {/* Testimonio 3: Enfoque Estudiantes / Mentoring */}
            <div className="bg-surface-container-lowest p-8 rounded-3xl border border-secondary/10 shadow-[0_10px_30px_-15px_rgba(0,0,0,0.05)] hover:-translate-y-1 transition-transform flex flex-col justify-between">
              <div>
                <div className="flex text-[#f3bd7a] mb-5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <svg
                      key={star}
                      className="w-5 h-5 fill-current"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className="text-on-surface-variant font-medium leading-relaxed mb-8 italic">
                  "El Programa de Mentoring fue clave para conseguir mi primera
                  pasantía. Además, el trato preferencial como estudiante en
                  PERUMIN es una experiencia inigualable."
                </p>
              </div>
              <div className="flex items-center gap-4">
                <img
                  src="https://randomuser.me/api/portraits/women/44.jpg"
                  alt="Valeria Torres"
                  className="w-12 h-12 rounded-full object-cover border-2 border-primary/20"
                />
                <div>
                  <h4 className="font-bold text-on-surface text-sm">
                    Valeria Torres
                  </h4>
                  <p className="text-xs text-secondary">
                    Estudiante de Ing. Metalúrgica
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================
                4. PLANES Y PRECIOS (El Cierre)
            ========================================= */}
      <section
        id="planes-afiliacion"
        className="py-24 px-6 lg:px-12 bg-surface"
      >
        <div className="max-w-[1280px] mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-extrabold text-on-surface mb-4 tracking-tight">
              Invierte en tu futuro hoy
            </h2>
            <p className="text-lg text-secondary max-w-2xl mx-auto">
              Selecciona la modalidad que se ajuste a tu perfil profesional o
              académico. Proceso 100% digital.
            </p>
          </div>

          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
            {/* TARJETA: ASOCIADO ACTIVO */}
            <div className="bg-surface-container-lowest rounded-3xl shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] border border-secondary/10 hover:shadow-[0_25px_50px_-12px_rgba(127,86,30,0.2)] hover:border-primary/40 hover:-translate-y-2 transition-all duration-300 flex flex-col relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary to-primary-container"></div>

              <div className="p-10 flex-grow flex flex-col">
                <div className="flex justify-between items-start mb-6">
                  <span className="bg-primary/10 text-primary border border-primary/20 text-xs font-extrabold px-3.5 py-1.5 rounded-full uppercase tracking-widest">
                    Profesional
                  </span>
                </div>

                <h3 className="text-3xl font-extrabold text-on-surface mb-2">
                  Asociado Activo
                </h3>
                <p className="text-sm text-secondary mb-6 h-10">
                  Para ingenieros, geólogos y metalurgistas con título
                  profesional o colegiatura.
                </p>

                {/* El Precio Desglosado */}
                <div className="mb-8 pb-8 border-b border-outline-variant">
                  <div className="flex items-end gap-2 mb-2">
                    <span className="text-5xl font-black text-on-surface">
                      S/ 300
                    </span>
                    <span className="text-secondary font-medium mb-1">
                      .00 / 1er año
                    </span>
                  </div>
                  <p className="text-xs text-secondary font-medium">
                    Incluye: Inscripción (S/ 150) + Cuota anual (S/ 150). <br />{" "}
                    Renovación automática anual a S/ 150.
                  </p>
                </div>

                <ul className="space-y-4 mb-10 flex-grow">
                  {[
                    "Voz y voto en Asambleas Generales.",
                    "Acceso OneMine y Revista Minería.",
                    "Tarifas VIP en PERUMIN y proEXPLO.",
                    "Uso de Restobar Minero y Salas VIP.",
                  ].map((beneficio, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-3 text-sm text-on-surface-variant font-medium"
                    >
                      <CheckCircle2
                        size={20}
                        className="text-primary shrink-0"
                      />
                      {beneficio}
                    </li>
                  ))}
                </ul>

                <Link
                  href="/postulacion/asociado/paso-1"
                  className="w-full py-4 rounded-xl text-white bg-primary font-bold text-sm tracking-widest uppercase hover:bg-[#4a2d00] transition-colors flex items-center justify-center gap-2 shadow-md"
                >
                  Comenzar Afiliación <ArrowRight size={18} />
                </Link>
              </div>
            </div>

            {/* TARJETA: ESTUDIANTE */}
            <div className="bg-surface-container-lowest rounded-3xl shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] border border-secondary/10 hover:shadow-[0_25px_50px_-12px_rgba(95,94,93,0.2)] hover:border-outline/50 hover:-translate-y-2 transition-all duration-300 flex flex-col relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-outline-variant"></div>

              <div className="p-10 flex-grow flex flex-col">
                <div className="flex justify-between items-start mb-6">
                  <span className="bg-secondary/10 text-[#6b5c4b] border border-[#6b5c4b]/20 text-xs font-extrabold px-3.5 py-1.5 rounded-full uppercase tracking-widest">
                    Académico
                  </span>
                </div>

                <h3 className="text-3xl font-extrabold text-on-surface mb-2">
                  Estudiante
                </h3>
                <p className="text-sm text-secondary mb-6 h-10">
                  Exclusivo para estudiantes de Pre-grado de carreras vinculadas
                  a la industria.
                </p>

                {/* Precio Estudiante */}
                <div className="mb-8 pb-8 border-b border-outline-variant">
                  <div className="flex items-end gap-2 mb-2">
                    <span className="text-5xl font-black text-on-surface text-transparent bg-clip-text bg-gradient-to-r from-[#6b5c4b] to-secondary">
                      Tarifa Especial
                    </span>
                  </div>
                  <p className="text-xs text-secondary font-medium">
                    Cuota preferencial exclusiva. Requiere constancia de
                    matrícula vigente.
                  </p>
                </div>

                <ul className="space-y-4 mb-10 flex-grow">
                  {[
                    "Programa exclusivo de Mentoring.",
                    "Tarifas preferenciales en congresos.",
                    "Acceso a Biblioteca OneMine.",
                    "Networking con profesionales.",
                  ].map((beneficio, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-3 text-sm text-on-surface-variant font-medium"
                    >
                      <CheckCircle2
                        size={20}
                        className="text-[#6b5c4b] shrink-0"
                      />
                      {beneficio}
                    </li>
                  ))}
                </ul>

                <Link
                  href="/postulacion/estudiante/paso-1"
                  className="w-full py-4 rounded-xl text-[#6b5c4b] border-2 border-[#6b5c4b] font-bold text-sm tracking-widest uppercase hover:bg-[#6b5c4b] hover:text-white transition-colors flex items-center justify-center gap-2"
                >
                  Afiliación Estudiante <ArrowRight size={18} />
                </Link>
              </div>
            </div>
          </div>

          {/* Botón de dudas */}
          <div className="text-center mt-12">
            <p className="text-sm text-secondary">
              ¿Tienes dudas sobre los requisitos?{" "}
              <a
                href="mailto:asociados@iimp.org.pe"
                className="font-bold text-primary hover:underline"
              >
                Contáctanos en asociados@iimp.org.pe
              </a>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
