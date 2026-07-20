import { prisma } from '@/lib/prisma';
import { seedLogger } from '@/lib/seed';

export const seedUniversities = async (): Promise<void> => {
  seedLogger.info('  -> Ejecutando seed de Universidades (Idempotente)...');

  const universities = [
    { name: 'Pontificia Universidad Católica del Perú (PUCP)', isLicensed: true },
    { name: 'Universidad Nacional de Ingeniería (UNI)', isLicensed: true },
    { name: 'Universidad Nacional Mayor de San Marcos (UNMSM)', isLicensed: true },
  ];

  for (const uni of universities) {
    // Patrón Find-or-Update porque 'name' no es @unique en el schema
    const exists = await prisma.university.findFirst({ where: { name: uni.name } });
    
    if (exists) {
      await prisma.university.update({
        where: { id: exists.id },
        data: { isLicensed: uni.isLicensed },
      });
    } else {
      await prisma.university.create({
        data: { name: uni.name, isLicensed: uni.isLicensed, isActive: true },
      });
    }
  }

  seedLogger.success(`  -> ${universities.length} universidades procesadas correctamente.`);
};