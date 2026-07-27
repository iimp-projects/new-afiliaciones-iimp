import { prisma } from '@/lib/prisma';
import { seedLogger } from '@/lib/seed';
import { universitiesData } from './data/universities.data';

export const seedUniversities = async (): Promise<void> => {
  seedLogger.info('  -> Ejecutando upsert de Universidades...');

  // Obtenemos los países para mapear las relaciones por ID o ISO
  const countries = await prisma.country.findMany({ select: { id: true, isoCode: true } });
  const countryMap = new Map(countries.map(c => [c.id, c.id]));

  let processedCount = 0;

  for (const uni of universitiesData) {
    // Verificamos que el país exista en la BD antes de insertar
    if (!countryMap.has(uni.countryId)) continue;

    await prisma.university.upsert({
      where: { 
        countryId_name: { 
          countryId: uni.countryId, 
          name: uni.name 
        } 
      },
      update: { isLicensed: uni.isLicensed },
      create: {
        name: uni.name,
        countryId: uni.countryId,
        isLicensed: uni.isLicensed ?? true,
        isActive: true,
      },
    });
    processedCount++;
  }

  seedLogger.success(`  -> ${processedCount} universidades procesadas correctamente.`);
};