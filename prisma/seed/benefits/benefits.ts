import { prisma } from '@/lib/prisma';

export async function seedBenefits() {
  const benefits = [
    {
      slug: 'networking-alto-nivel',
      title: 'Networking de Alto Nivel',
      description: 'Disfruta de participación preferencial en los Jueves Mineros presenciales y accede al exclusivo Restobar Minero.',
      iconName: 'Users',
      badgeText: 'MÁS POPULAR',
      redirectUrl: '/beneficios/networking-alto-nivel',
      order: 1,
      isActive: true, // <--- Agregado
    },
    {
      slug: 'recursos-digitales',
      title: 'Recursos Digitales',
      description: 'Acceso ilimitado a OneMine, publicaciones técnicas, la Revista Minería y la biblioteca IIMP.',
      iconName: 'BookOpen',
      badgeText: 'ACCESO VIP',
      redirectUrl: '/beneficios/recursos-digitales',
      order: 2,
      isActive: true, // <--- Agregado
    },
    {
      slug: 'eventos-top',
      title: 'Eventos Top',
      description: 'Tarifas preferenciales que amortizan tu membresía en PERUMIN y eventos internacionales.',
      iconName: 'Ticket',
      badgeText: 'DESCUENTOS',
      redirectUrl: '/beneficios/eventos-top',
      order: 3,
      isActive: true, // <--- Agregado
    },
    {
      slug: 'desarrollo-profesional',
      title: 'Desarrollo Profesional',
      description: 'Cursos especializados, certificación profesional y programas de mentoría activa.',
      iconName: 'GraduationCap',
      badgeText: 'CRECIMIENTO',
      redirectUrl: '/beneficios/desarrollo-profesional',
      order: 4,
      isActive: true, // <--- Agregado
    },
  ];

  for (const benefit of benefits) {
    await prisma.benefit.upsert({
      where: { slug: benefit.slug },
      update: benefit,
      create: benefit,
    });
  }
}