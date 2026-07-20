// prisma/seed/catalogs/departments.seed.ts
import { prisma } from '@/lib/prisma';
import { seedLogger, SEED_CONSTANTS } from '@/lib/seed';

export const seedDepartments = async (): Promise<void> => {
  seedLogger.info('  -> Ejecutando upsert de Departamentos...');

  // 1. Obtener la referencia segura (Dependencia)
  const peru = await prisma.country.findUnique({
    where: { isoCode: SEED_CONSTANTS.COUNTRIES.PERU.isoCode },
  });

  if (!peru) {
    seedLogger.warn('     ⚠️ País Perú no encontrado. Abortando seed de Departamentos.');
    return;
  }

  // 2. Data inicial basada en códigos Ubigeo reales
  const departments = [
    { ubigeoCode: '150000', name: 'Lima' },
    { ubigeoCode: '040000', name: 'Arequipa' },
    { ubigeoCode: '080000', name: 'Cusco' },
    { ubigeoCode: '130000', name: 'La Libertad' },
    { ubigeoCode: '200000', name: 'Piura' },
    { ubigeoCode: '070000', name: 'Callao' },
  ];

  for (const dept of departments) {
    await prisma.department.upsert({
      where: { ubigeoCode: dept.ubigeoCode },
      update: {
        name: dept.name,
        countryId: peru.id, // Forzamos que siempre mantenga la relación correcta
      },
      create: {
        ubigeoCode: dept.ubigeoCode,
        name: dept.name,
        countryId: peru.id,
        isActive: true,
      },
    });
  }

  seedLogger.success(`  -> ${departments.length} departamentos procesados correctamente.`);
};