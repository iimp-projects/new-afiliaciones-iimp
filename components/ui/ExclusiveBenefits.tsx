import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { Users, Globe, Ticket, GraduationCap, ChevronRight, Sparkles, LucideIcon } from 'lucide-react';

const iconMap: Record<string, LucideIcon> = {
  Users,
  Globe,
  Ticket,
  GraduationCap,
};

export default async function ExclusiveBenefits() {
  const benefits = await prisma.benefit.findMany({
    where: { isActive: true },
    orderBy: { order: 'asc' },
  });

  return (
    <section className="py-16 px-4 max-w-7xl mx-auto bg-[#F4F5F7]">
      {/* Header de la sección */}
      <div className="text-center max-w-3xl mx-auto mb-12">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wide uppercase bg-[#C39254]/10 text-[#C39254]">
          <Sparkles className="w-3.5 h-3.5" />
          Beneficios Exclusivos
        </span>
        <h2 className="text-3xl md:text-4xl font-extrabold text-[#3E3E3D] tracking-tight mt-3">
          Tu acceso directo a la <span className="text-[#C39254]">excelencia minera</span>
        </h2>
        <p className="mt-3 text-base text-[#3E3E3D]/80">
          Diseñado para profesionales que exigen lo mejor. Multiplica tu inversión con accesos liberados, herramientas globales y la red de contactos más influyente del país.
        </p>
      </div>

      {/* Grid de Tarjetas Interactivas con Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {benefits.map((benefit) => {
          const iconKey = benefit.iconName || '';
          const IconComponent: LucideIcon = (iconMap as any)[iconKey] || Sparkles;

          return (
            <Link
              key={benefit.id}
              href={`/beneficios/${benefit.slug}`}
              className="group bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between hover:-translate-y-1 block cursor-pointer"
            >
              <div>
                <div className="w-12 h-12 rounded-xl bg-[#C39254]/10 text-[#C39254] flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <IconComponent className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-[#3E3E3D] mb-2 group-hover:text-[#C39254] transition-colors">
                  {benefit.title}
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {benefit.description}
                </p>
              </div>

              <div className="mt-6 flex items-center text-xs font-bold text-[#C39254] group-hover:gap-2 transition-all">
                <span>Saber más</span>
                <ChevronRight className="w-4 h-4 ml-1" />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}