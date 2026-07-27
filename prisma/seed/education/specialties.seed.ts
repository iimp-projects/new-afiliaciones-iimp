import { prisma } from '@/lib/prisma';
import { seedLogger } from '@/lib/seed';
import { specialtiesData } from './data/specialties.data';

export const seedSpecialties = async (): Promise<void> => {
  seedLogger.info('  -> Ejecutando upsert de Especialidades...');

  let processedCount = 0;

  for (const spec of specialtiesData) {
    await prisma.specialty.upsert({
      where: { code: spec.code ?? `SPEC-${spec.name.replace(/\s+/g, '-').toUpperCase()}` },
      update: { description: spec.description },
      create: {
        name: spec.name,
        code: spec.code ?? `SPEC-${spec.name.replace(/\s+/g, '-').toUpperCase()}`,
        description: spec.description,
        isActive: true,
      },
    });
    processedCount++;
  }

  seedLogger.success(`  -> ${processedCount} especialidades procesadas correctamente.`);
};