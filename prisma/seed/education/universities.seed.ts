import { prisma } from '@/lib/prisma';
import { seedLogger } from '@/lib/seed';
import { universitiesData } from './data/universities.data';

export const seedUniversities = async (): Promise<void> => {
  seedLogger.info('   -> Ejecutando upsert de Universidades...');

  // Obtenemos los países para mapear las relaciones por ID
  const countries = await prisma.country.findMany({ select: { id: true } });
  const countryMap = new Set(countries.map(c => c.id));

  let processedCount = 0;

  for (const uni of universitiesData) {
    // Verificamos que el país exista en la BD antes de procesar
    if (!countryMap.has(uni.countryId)) continue;

    await prisma.university.upsert({
      where: { 
        countryId_name: { 
          countryId: uni.countryId, 
          name: uni.name 
        } 
      },
      // Actualizamos todos los campos por si cambiaron en el file de data
      update: { 
        acronym: uni.acronym ?? null,
        isLicensed: uni.isLicensed ?? true,
        isPublic: uni.isPublic ?? false,
        isActive: uni.isActive ?? true,
      },
      // Creamos con la estructura completa
      create: {
        name: uni.name,
        acronym: uni.acronym ?? null,
        countryId: uni.countryId,
        isLicensed: uni.isLicensed ?? true,
        isPublic: uni.isPublic ?? false,
        isActive: uni.isActive ?? true,
      },
    });
    processedCount++;
  }

  seedLogger.success(`   -> ${processedCount} universidades e institutos procesados correctamente.`);
};