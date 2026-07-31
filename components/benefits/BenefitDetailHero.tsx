"use client";

import Link from "next/link";
import { ArrowLeft, Play, MapPin, Calendar, Sparkles, ExternalLink } from "lucide-react";

interface BenefitData {
  id: string;
  title: string;
  description: string;
  slug: string;
  badgeText?: string | null;
  redirectUrl?: string | null;
}

export default function BenefitDetailHero({ benefit }: { benefit: BenefitData }) {
  // 1. Identificar el tipo de beneficio actual
  const isRecursos = benefit.slug === "recursos-digitales";
  const isEventos = benefit.slug === "eventos-top";
  const isDesarrollo = benefit.slug === "desarrollo-profesional";


  // 2. Ticker / Marquee dinámico
  const marqueeItems = isRecursos
    ? [
        "◆ MÁS DE 150,000 ARTÍCULOS TÉCNICOS",
        "◆ ACCESO ILIMITADO 24/7",
        "◆ REVISTA MINERÍA Y BIBLIOTECA IIMP",
        "◆ DOCUMENTOS E INVESTIGACIONES GLOBALES",
      ]
    : isEventos
    ? [
        "◆ DESCUENTOS EXCLUSIVOS EN PERUMIN",
        "◆ TARIFAS PREFERENCIALES EN PROEXPLO",
        "◆ CONGRESOS Y SIMPOSIOS INTERNACIONALES",
        "◆ ACCESO PREFERENCIAL A EVENTOS VIP",
      ]
      : isDesarrollo
    ? [
        "◆ MENTORING Y CANTERA DE TALENTOS",
        "◆ CURSOS Y DIPLOMADOS ESPECIALIZADOS",
        "◆ TALLERES DE LIDERAZGO Y HABILIDADES BLANDAS",
        "◆ CERTIFICACIONES CON VALOR ACADÉMICO",
      ]
    : [
        "◆ RED DE PROFESIONALES DEL RUBRO",
        "◆ MÁS DE 5,000 ASOCIADOS ACTIVOS",
        "◆ ACCESO AL RESTOBAR MINERO",
        "◆ JUEVES MINEROS CON EXPOSITORES VIP",
      ];

  // 3. Galería de eventos o recursos destacados (3 Cards)
  const highlights = isRecursos
    ? [
        {
          year: "GLOBAL",
          title: "Base de Datos OneMine",
          author: "Más de 150,000 papers y artículos técnicos",
          image: "https://s3-iimp-gestor-de-archivos-v3.s3.sa-east-1.amazonaws.com/boletines/noticias/images/imagenes/IMG20260731_114810.png",
          link: "https://onemine.org",
        },
        {
          year: "IIMP DIGITAL",
          title: "Revista Minería Web",
          author: "Ediciones semanales y mensuales digitales",
          image: "https://s3-iimp-gestor-de-archivos-v3.s3.sa-east-1.amazonaws.com/boletines/images/IMG20260622_104655.jpg",
          link: "https://revistamineria.com.pe/",
        },
        {
          year: "SEDE IIMP",
          title: "Biblioteca del IIMP",
          author: "Acervo bibliográfico especializado y sala de lectura",
          image: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&q=80",
          link: "https://iimp.org.pe",
        },
      ]
    : isEventos
    ? [
        {
          year: "CONVENCION MINERA",
          title: "PERUMIN 37",
          author: "Descuento especial en inscripciones y área comercial",
          image: "https://s3-iimp-gestor-de-archivos-v3.s3.sa-east-1.amazonaws.com/perumin/38/img/IMG20260731_125149.jpg",
          link: "https://perumin.com/perumin37/public/es",
        },
        {
          year: "EXPLORACION",
          title: "proEXPLO",
          author: "Tarifas preferenciales en el Congreso Internacional de Prospectores y Exploradores",
          image: "https://s3-iimp-gestor-de-archivos-v3.s3.sa-east-1.amazonaws.com/proexplo/2026/images/IMG20260731_124903.jpg",
          link: "https://proexplo.com.pe",
        },
        {
          year: "INTERNACIONAL",
          title: "WMC 2026",
          author: "Eventos especializados del sector a nivel global",
          image: "https://s3-iimp-gestor-de-archivos-v3.s3.sa-east-1.amazonaws.com/boletines/images/IMG20260731_124259.jpg",
          link: "https://wmc2026.org/",
        },
      ]
      : isDesarrollo
    ? [
        {
          year: "PROGRAMA VIP",
          title: "Cantera de Talentos",
          author: "Programa de desarrollo integral para jóvenes profesionales",
          image: "https://s3-iimp-gestor-de-archivos-v3.s3.sa-east-1.amazonaws.com/boletines/noticias/images/imagenes/IMG20260731_141036.jpg",
          link: "https://iimp.org.pe/cantera-de-talentos",
        },
        {
          year: "CAPACITACIÓN",
          title: "Cursos Especializados",
          author: "Descuentos preferenciales en cursos y programas",
          image: "https://s3-iimp-gestor-de-archivos-v3.s3.sa-east-1.amazonaws.com/perumin/38/img/IMG20260731_141813.jpg",
          link: "https://iimp.org.pe/desarrollo-profesional",
        },
        {
          year: "FORMACIÓN",
          title: "Mentoring & Foros",
          author: "Acompañamiento y orientación de líderes senior del sector",
          image: "https://s3-iimp-gestor-de-archivos-v3.s3.sa-east-1.amazonaws.com/boletines/noticias/images/imagenes/IMG20260731_144603.jpg",
          link: "https://iimp.org.pe/mentoring",
        },
      ]
    : [
        {
          year: "2025",
          title: "Bienvenida Asociados IIMP",
          author: "Socios Activos",
          image: "https://s3-iimp-gestor-de-archivos-v3.s3.sa-east-1.amazonaws.com/boletines/noticias/images/imagenes/IMG20260731_092505.jpg",
          link: "https://www.flickr.com/photos/198943747@N06/albums/72177720334747919/with/55401134825",
        },
        {
          year: "2026",
          title: "Jueves Minero",
          author: "Expositores VIP",
          image: "https://s3-iimp-gestor-de-archivos-v3.s3.sa-east-1.amazonaws.com/boletines/noticias/images/imagenes/IMG20260731_091145.jpg",
          link: "https://www.flickr.com/photos/198943747@N06/albums/72177720334734068/",
        },
        {
          year: "2026",
          title: "Desayuno Empresarial",
          author: "Sede IIMP",
          image: "https://s3-iimp-gestor-de-archivos-v3.s3.sa-east-1.amazonaws.com/boletines/noticias/images/imagenes/IMG20260731_091919.jpg",
          link: "https://www.flickr.com/photos/198943747@N06/albums/72177720334610044/",
        },
      ];

  return (
    <div className="min-h-screen bg-[#F4F5F7] text-[#3E3E3D] selection:bg-[#C39254] selection:text-white font-sans relative overflow-x-hidden">
      
      {/* 1. TOP BAR */}
      <nav className="border-b border-gray-200 bg-white/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link
            href="/postulacion"
            className="inline-flex items-center gap-2 text-sm font-bold text-gray-600 hover:text-[#C39254] transition-colors"
          >
            <ArrowLeft size={18} /> Volver a la postulación
          </Link>
          <span className="text-xs font-black uppercase tracking-widest text-[#C39254] bg-[#C39254]/10 border border-[#C39254]/30 px-3 py-1 rounded-full">
            {benefit.badgeText || (isEventos ? "DESCUENTOS EXCLUSIVOS" : "ACCESO EXCLUSIVO")}
          </span>
        </div>
      </nav>

      {/* 2. HERO PRINCIPAL */}
      <section className="relative pt-12 pb-20 px-6 lg:px-12 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div className="absolute top-1/4 left-0 w-96 h-96 bg-[#C39254]/10 rounded-full blur-[140px] pointer-events-none"></div>

        <div className="lg:col-span-7 z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-gray-200 text-[#C39254] text-xs font-extrabold uppercase tracking-widest mb-6 shadow-sm">
            <Sparkles size={14} /> Membresía IIMP
          </div>

          <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-tight mb-6 text-[#3E3E3D]">
            Vive la experiencia <br />
            <span className="text-[#C39254]">
              {benefit.title}
            </span>
          </h1>

          <p className="text-gray-600 text-lg sm:text-xl font-medium leading-relaxed mb-8 max-w-2xl">
            {benefit.description} Conecta directamente con la comunidad de profesionales y referentes más activa del sector minero en el país.
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <Link
              href="/postulacion#planes-afiliacion"
              className="px-8 py-4 rounded-xl bg-[#C39254] text-white font-black uppercase tracking-wider text-sm hover:bg-[#b08146] hover:scale-105 transition-all text-center"
            >
              ¡Quiero Afiliarme Ahora!
            </Link>
          </div>
        </div>

        {/* Tarjeta Visual Dinámica */}
        <div className="lg:col-span-5 relative z-10">
          <div className="relative group rounded-3xl overflow-hidden border border-gray-200 bg-white p-2 shadow-xl transform lg:rotate-2 hover:rotate-0 transition-all duration-500">
            <div className="relative aspect-[4/5] rounded-2xl overflow-hidden bg-gray-900">
              <img
                src={
                  isRecursos
                    ? "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&q=80"
                    : isEventos
                    ? "https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&q=80"
                    : "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&q=80"
                }
                alt={benefit.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-80"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent"></div>

              {!isRecursos && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-20 h-20 rounded-full bg-[#C39254] flex items-center justify-center text-white shadow-xl cursor-pointer hover:scale-110 transition-transform">
                    <Play size={32} className="ml-1 fill-white" />
                  </div>
                </div>
              )}

              <div className="absolute bottom-6 left-6 right-6 text-white">
                <span className="text-xs font-black uppercase tracking-widest text-[#C39254] mb-1 block">
                  {isRecursos ? "Acceso Digital" : isEventos ? "Tarifas Preferenciales" : "Revive la Experiencia"}
                </span>
                <h3 className="text-xl font-bold text-white mb-2">
                  {isRecursos
                    ? "Biblioteca Digital Minera"
                    : isEventos
                    ? "PERUMIN, proEXPLO & Congresos VIP"
                    : "Networking Presencial & Restobar Minero"}
                </h3>
                <div className="flex items-center gap-4 text-xs text-gray-300 font-medium">
                  <span className="flex items-center gap-1">
                    <MapPin size={14} className="text-[#C39254]" />
                    {isRecursos ? "Plataforma Online" : isEventos ? "Sedes Variadas & Arequipa" : "Sede IIMP"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar size={14} className="text-[#C39254]" />
                    {isRecursos ? "Acceso 24/7" : isEventos ? "Calendario Anual" : "Todos los Jueves"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. TICKER EN MOVIMIENTO CONTINUO */}
      <div className="w-full bg-[#C39254] py-3 text-white font-black uppercase tracking-widest text-sm overflow-hidden whitespace-nowrap shadow-md">
        <style>{`
          @keyframes marqueeScroll {
            0% { transform: translateX(0%); }
            100% { transform: translateX(-50%); }
          }
          .marquee-track {
            display: flex;
            width: max-content;
            animation: marqueeScroll 20s linear infinite;
          }
        `}</style>
        <div className="marquee-track flex gap-8">
          {[...marqueeItems, ...marqueeItems, ...marqueeItems].map((item, idx) => (
            <span key={idx} className="flex items-center gap-8">
              {item}
            </span>
          ))}
        </div>
      </div>

      {/* 4. GALERÍA / RECURSOS */}
      <section className="py-20 px-6 lg:px-12 max-w-7xl mx-auto">
        <div className="mb-12">
          <h2 className="text-3xl sm:text-5xl font-black mb-4 text-[#3E3E3D]">
            <span className="text-[#C39254]">
              {isRecursos ? "Explora" : isEventos ? "Descubre" : "Revive"}
            </span>{" "}
            {isRecursos 
              ? "el conocimiento exclusivo" 
              : isEventos 
              ? "los eventos destacados del sector" 
              : "cómo se vive este beneficio"}
          </h2>
          <p className="text-gray-600 font-medium text-lg">
            {isRecursos
              ? "Accede a miles de documentos técnicos, investigaciones e información clave del sector."
              : isEventos
              ? "Disfruta de beneficios económicos directo en las inscripciones de nuestros principales congresos."
              : "Imágenes y testimonios de nuestras ediciones recientes con la comunidad de asociados."}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {highlights.map((item, idx) => (
            <a
              key={idx}
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
              className="group bg-white border border-gray-200 rounded-2xl overflow-hidden hover:border-[#C39254] hover:shadow-xl transition-all duration-300 block cursor-pointer"
            >
              <div className="relative aspect-video overflow-hidden bg-gray-100">
                <img
                  src={item.image}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md text-white font-black text-xs px-2.5 py-1 rounded-md">
                  {item.year}
                </div>
                
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="bg-[#C39254] text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg flex items-center gap-1.5">
                    {isRecursos ? "Ver recurso" : isEventos ? "Más información": isDesarrollo ? "Más información" : "Ver fotos"} <ExternalLink size={14} />
                  </span>
                </div>
              </div>
              <div className="p-5">
                <h4 className="font-bold text-[#3E3E3D] text-lg group-hover:text-[#C39254] transition-colors mb-1">
                  {item.title}
                </h4>
                <p className="text-xs text-gray-500 font-medium">{item.author}</p>
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* 5. CTA FINAL */}
      <section className="py-16 px-6 max-w-5xl mx-auto mb-16">
        <div className="bg-white border border-gray-200 rounded-3xl p-8 sm:p-12 text-center relative overflow-hidden shadow-xl">
          <h2 className="text-3xl sm:text-4xl font-black mb-4 text-[#3E3E3D]">
            ¿Listo para formar parte de la red minera más grande?
          </h2>
          <p className="text-gray-600 max-w-xl mx-auto mb-8 font-medium">
            Forma parte del Instituto de Ingenieros de Minas del Perú y accede inmediatamente a todos estos beneficios.
          </p>
          <Link
            href="/postulacion#planes-afiliacion"
            className="inline-block px-8 py-4 rounded-xl bg-[#C39254] text-white font-black uppercase tracking-wider text-sm hover:bg-[#b08146] hover:scale-105 transition-all shadow-lg shadow-[#C39254]/20"
          >
            Iniciar Mi Afiliación
          </Link>
        </div>
      </section>

    </div>
  );
}