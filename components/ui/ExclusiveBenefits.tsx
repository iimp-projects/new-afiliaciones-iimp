import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { 
  Users, 
  Globe, 
  Ticket, 
  GraduationCap, 
  ChevronRight, 
  Sparkles, 
  Play, 
  Coffee, 
  ArrowRight, 
  LucideIcon 
} from 'lucide-react';

const iconMap: Record<string, LucideIcon> = {
  Users,
  Globe,
  Ticket,
  GraduationCap,
  Coffee
};

export default async function ExclusiveBenefits() {
  // Consultar todos los beneficios activos ordenados desde la BD
  const benefits = await prisma.benefit.findMany({
    where: { isActive: true },
    orderBy: { order: 'asc' },
  });

  if (!benefits || benefits.length === 0) return null;

  // Separar el primer beneficio (Networking) de los demás (OneMine, Eventos, etc.)
  const featuredBenefit = benefits[0];
  const otherBenefits = benefits.slice(1);

  return (
    <section className="py-16 px-6 max-w-6xl mx-auto space-y-6">
      
      {/* 1. TARJETA BANNER PRINCIPAL (NETWORKING / DESTACADO) */}
      {featuredBenefit && (
        <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-shadow grid grid-cols-1 lg:grid-cols-12">
          
          {/* Lado izquierdo con Video/Imagen */}
          <div className="lg:col-span-7 relative min-h-[260px] bg-black flex items-center justify-center group overflow-hidden">
            <img
              src="https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&q=80"
              alt={featuredBenefit.title}
              className="absolute inset-0 w-full h-full object-cover opacity-70 group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>

            {/* Botón Flotante interactivo */}
            <Link
              href={`/beneficios/${featuredBenefit.slug}`}
              className="relative z-10 flex items-center gap-3 bg-black/40 backdrop-blur-md border border-white/20 p-2 pr-5 rounded-full hover:bg-black/60 transition-all group/btn"
            >
              <div className="w-10 h-10 rounded-full bg-[#C39254] flex items-center justify-center text-white shadow-lg group-hover/btn:scale-110 transition-transform">
                <Play size={18} className="fill-white ml-0.5" />
              </div>
              <div className="text-left">
                <p className="text-white text-xs font-black uppercase tracking-wider">
                  Experiencia IIMP
                </p>
                <p className="text-gray-300 text-[10px]">Conecta con los líderes</p>
              </div>
            </Link>
          </div>

          {/* Lado derecho con Contenido */}
          <div className="lg:col-span-5 p-8 sm:p-10 flex flex-col justify-between bg-white">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-[#C39254]/10 flex items-center justify-center mb-6 text-[#C39254]">
                <Coffee size={22} />
              </div>

              <h3 className="text-2xl font-black text-[#3E3E3D] mb-3">
                {featuredBenefit.title}
              </h3>

              <p className="text-gray-500 text-sm font-medium leading-relaxed mb-6">
                {featuredBenefit.description}
              </p>
            </div>

            <Link
              href={`/beneficios/${featuredBenefit.slug}`}
              className="inline-flex items-center gap-1.5 text-xs font-black text-[#C39254] uppercase tracking-wider hover:gap-3 transition-all"
            >
              Ver detalles <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      )}

      {/* 2. GRID DE LAS DEMÁS TARJETAS (ONEMINE, EVENTOS, ETC.) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {otherBenefits.map((benefit) => {
          const iconKey = benefit.iconName || '';
          const IconComponent: LucideIcon = iconMap[iconKey] || Sparkles;

          return (
            <div
              key={benefit.id}
              className="bg-white border border-gray-100 rounded-3xl p-8 flex flex-col justify-between shadow-sm hover:shadow-md transition-all group"
            >
              <div>
                <div className="w-12 h-12 rounded-2xl bg-[#C39254]/10 flex items-center justify-center mb-6 text-[#C39254]">
                  <IconComponent size={22} />
                </div>

                <h4 className="text-xl font-bold text-[#3E3E3D] mb-3">
                  {benefit.title}
                </h4>

                <p className="text-gray-500 text-xs font-medium leading-relaxed mb-8">
                  {benefit.description}
                </p>
              </div>

              <Link
                href={`/beneficios/${benefit.slug}`}
                className="inline-flex items-center gap-1.5 text-xs font-black text-[#C39254] uppercase tracking-wider hover:gap-2.5 transition-all"
              >
                Saber más <ArrowRight size={14} />
              </Link>
            </div>
          );
        })}
      </div>

    </section>
  );
}