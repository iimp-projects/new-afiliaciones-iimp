import { prisma } from '@/lib/prisma';
import { seedLogger } from '@/lib/seed';

export const seedSpecialties = async (): Promise<void> => {
  seedLogger.info('  -> Ejecutando seed de Especialidades (Idempotente)...');

  const specialties = [
    { name: 'Ingeniería de Minas', description: 'Especialidad principal de extracción minera' },
    { name: 'Ingeniería Geológica', description: 'Exploración y evaluación de yacimientos' },
    { name: 'Ingeniería Metalúrgica', description: 'Procesamiento de minerales' },
  ];

  for (const spec of specialties) {
    const exists = await prisma.specialty.findFirst({ where: { name: spec.name } });
    
    if (exists) {
      await prisma.specialty.update({
        where: { id: exists.id },
        data: { description: spec.description },
      });
    } else {
      await prisma.specialty.create({
        data: { name: spec.name, description: spec.description, isActive: true },
      });
    }
  }

  seedLogger.success(`  -> ${specialties.length} especialidades procesadas correctamente.`);
};