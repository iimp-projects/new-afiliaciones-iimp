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

export default function NetworkingHero({ benefit }: { benefit: BenefitData }) {
  const highlights = [
    { year: "2026", title: "Jueves Minero Networking", author: "Expositores VIP", image: "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&q=80" },
    { year: "2025", title: "Desayuno Empresarial", author: "Sede IIMP", image: "https://images.unsplash.com/photo-1475721027785-f74eccf877e2?auto=format&fit=crop&q=80" },
    { year: "2023", title: "Aniversario IIMP", author: "Socios Activos", image: "https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&q=80" },

  ];

  const marqueeItems = [
    "◆ RED DE PROFESIONALES DEL RUBRO",
    "◆ MÁS DE 5,000 ASOCIADOS ACTIVOS",
    "◆ ACCESO AL RESTOBAR MINERO",
    "◆ BIBLIOTECA Y SALA DE LECTURA EXCLUSIVA",
    "◆ JUEVES MINEROS CON EXPOSITORES VIP",
  ];

  return (
    <div className="min-h-screen bg-[#0D0F12] text-white selection:bg-[#C39254] selection:text-black font-sans relative overflow-x-hidden">
      
      {/* 1. TOP BAR */}
      <nav className="border-b border-white/10 bg-[#0D0F12]/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link
            href="/postulacion"
            className="inline-flex items-center gap-2 text-sm font-bold text-gray-400 hover:text-[#C39254] transition-colors"
          >
            <ArrowLeft size={18} /> Volver a la postulación
          </Link>
          <span className="text-xs font-black uppercase tracking-widest text-[#C39254] bg-[#C39254]/10 border border-[#C39254]/20 px-3 py-1 rounded-full">
            {benefit.badgeText || "MÁS POPULAR"}
          </span>
        </div>
      </nav>

      {/* 2. HERO PRINCIPAL */}
      <section className="relative pt-12 pb-20 px-6 lg:px-12 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <div className="absolute top-1/4 left-0 w-96 h-96 bg-[#C39254]/20 rounded-full blur-[140px] pointer-events-none"></div>

        <div className="lg:col-span-7 z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[#C39254] text-xs font-extrabold uppercase tracking-widest mb-6">
            <Sparkles size={14} /> Membresía IIMP
          </div>

          <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-tight mb-6">
            Vive la experiencia <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#F5D089] via-[#C39254] to-[#8C6215]">
              {benefit.title}
            </span>
          </h1>

          <p className="text-gray-400 text-lg sm:text-xl font-medium leading-relaxed mb-8 max-w-2xl">
            {benefit.description} Conecta directamente con la comunidad de profesionales y referentes más activa del sector minero en el país.
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <Link
              href="/postulacion"
              className="px-8 py-4 rounded-xl bg-gradient-to-r from-[#D6A84A] to-[#8C6215] text-black font-black uppercase tracking-wider text-sm hover:scale-105 transition-all duration-300 text-center shadow-[0_0_30px_rgba(195,146,84,0.4)]"
            >
              ¡Quiero Afiliarme Ahora!
            </Link>

            {benefit.redirectUrl && (
              <a
                href={benefit.redirectUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-4 rounded-xl border border-white/20 bg-white/5 text-white font-bold text-sm hover:bg-white/10 transition-all flex items-center justify-center gap-2"
              >
                <span>Acceso directo</span>
                <ExternalLink size={16} />
              </a>
            )}
          </div>
        </div>

        {/* Tarjeta Visual de Networking */}
        <div className="lg:col-span-5 relative z-10">
          <div className="relative group rounded-3xl overflow-hidden border border-white/15 bg-gradient-to-b from-white/10 to-white/5 p-2 shadow-2xl transform lg:rotate-2 hover:rotate-0 transition-all duration-500">
            <div className="relative aspect-[4/5] rounded-2xl overflow-hidden bg-black">
              <img
                src="https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&q=80"
                alt="Networking IIMP"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-70"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent"></div>

              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-20 h-20 rounded-full bg-[#C39254] flex items-center justify-center text-black shadow-[0_0_40px_rgba(195,146,84,0.8)] cursor-pointer hover:scale-110 transition-transform">
                  <Play size={32} className="ml-1 fill-black" />
                </div>
              </div>

              <div className="absolute bottom-6 left-6 right-6">
                <span className="text-xs font-black uppercase tracking-widest text-[#C39254] mb-1 block">
                  Revive la Experiencia
                </span>
                <h3 className="text-xl font-bold text-white mb-2">
                  Networking Presencial & Restobar Minero
                </h3>
                <div className="flex items-center gap-4 text-xs text-gray-300 font-medium">
                  <span className="flex items-center gap-1"><MapPin size={14} className="text-[#C39254]" /> Sede IIMP</span>
                  <span className="flex items-center gap-1"><Calendar size={14} className="text-[#C39254]" /> Todos los Jueves</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. TICKER EN MOVIMIENTO CONTINUO */}
      {/* 3. TICKER EN MOVIMIENTO CONTINUO (Fix garantizado) */}
      <div className="w-full bg-gradient-to-r from-[#D6A84A] via-[#C39254] to-[#8C6215] py-3 text-black font-black uppercase tracking-widest text-sm overflow-hidden whitespace-nowrap shadow-lg">
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

      {/* 4. GALERÍA DE EVENTOS */}
      <section className="py-20 px-6 lg:px-12 max-w-7xl mx-auto">
        <div className="mb-12">
          <h2 className="text-3xl sm:text-5xl font-black mb-4">
            <span className="text-[#C39254]">Revive</span> cómo se vive este beneficio
          </h2>
          <p className="text-gray-400 font-medium text-lg">
            Imágenes y testimonios de nuestras ediciones recientes con la comunidad de asociados.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {highlights.map((item, idx) => (
            <div
              key={idx}
              className="group bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:border-[#C39254]/50 transition-all duration-300 cursor-pointer"
            >
              <div className="relative aspect-video overflow-hidden">
                <img
                  src={item.image}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 opacity-80"
                />
                <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md text-[#C39254] font-black text-xs px-2.5 py-1 rounded-md border border-white/10">
                  {item.year}
                </div>
              </div>
              <div className="p-5">
                <h4 className="font-bold text-white text-lg group-hover:text-[#C39254] transition-colors mb-1">
                  {item.title}
                </h4>
                <p className="text-xs text-gray-400 font-medium">{item.author}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 5. CTA FINAL */}
      <section className="py-16 px-6 max-w-5xl mx-auto mb-16">
        <div className="bg-gradient-to-r from-white/10 via-white/5 to-white/10 border border-white/15 rounded-3xl p-8 sm:p-12 text-center relative overflow-hidden">
          <h2 className="text-3xl sm:text-4xl font-black mb-4">
            ¿Listo para formar parte de la red minera más grande?
          </h2>
          <p className="text-gray-300 max-w-xl mx-auto mb-8 font-medium">
            Forma parte del Instituto de Ingenieros de Minas del Perú y accede inmediatamente a todos estos beneficios.
          </p>
          <Link
            href="/postulacion"
            className="inline-block px-8 py-4 rounded-xl bg-[#C39254] text-black font-black uppercase tracking-wider text-sm hover:scale-105 transition-all shadow-[0_0_25px_rgba(195,146,84,0.5)]"
          >
            Iniciar Mi Afiliación
          </Link>
        </div>
      </section>

    </div>
  );
}