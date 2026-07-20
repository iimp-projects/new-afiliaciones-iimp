import { prisma } from '@/lib/prisma';
import { seedLogger } from '@/lib/seed';

export const seedDistricts = async (): Promise<void> => {
  seedLogger.info('  -> Ejecutando upsert de Distritos...');

  // Referencia segura: Provincia de Lima
  const limaProv = await prisma.province.findUnique({ where: { ubigeoCode: '150100' } });

  if (!limaProv) {
    seedLogger.warn('     ⚠️ Provincia de Lima no encontrada. Abortando seed de Distritos.');
    return;
  }

  const districts = [
    { ubigeoCode: '150101', name: 'Lima' },
    { ubigeoCode: '150122', name: 'Miraflores' },
    { ubigeoCode: '150131', name: 'San Isidro' },
    { ubigeoCode: '150140', name: 'Santiago de Surco' },
  ];

  for (const dist of districts) {
    await prisma.district.upsert({
      where: { ubigeoCode: dist.ubigeoCode },
      update: { name: dist.name, provinceId: limaProv.id },
      create: { ubigeoCode: dist.ubigeoCode, name: dist.name, provinceId: limaProv.id },
    });
  }

  seedLogger.success(`  -> ${districts.length} distritos procesados correctamente.`);
};