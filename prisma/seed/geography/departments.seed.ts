import { prisma } from '@/lib/prisma';
import { seedLogger } from '@/lib/seed';
import { departmentsData } from './data/departaments.data'; // Asegúrate de que el nombre del archivo coincida con tu proyecto

export const seedDepartments = async (): Promise<void> => {
  seedLogger.info('  -> Ejecutando upsert de Departamentos...');

  // 1. Obtenemos TODOS los países en una sola consulta para armar un mapa en memoria O(1)
  const countries = await prisma.country.findMany({
    select: { id: true, isoCode: true }
  });

  const countryMap = new Map(countries.map(c => [c.isoCode, c.id]));

  let processedCount = 0;

  for (const dept of departmentsData) {
    // 2. Resolvemos el countryId usando el ISO estandarizado
    const countryId = countryMap.get(dept.countryIso);

    if (!countryId) {
      seedLogger.warn(`      ⚠️ País no encontrado para ISO: ${dept.countryIso}. Saltando departamento: ${dept.name}.`);
      continue;
    }

    // 3. Upsert idempotente y seguro
    await prisma.department.upsert({
      where: { ubigeoCode: dept.ubigeoCode },
      update: { 
        name: dept.name, 
        countryId: countryId 
      },
      create: { 
        ubigeoCode: dept.ubigeoCode, 
        name: dept.name, 
        countryId: countryId, 
        isActive: true 
      },
    });

    processedCount++;
  }

  seedLogger.success(`  -> ${processedCount} departamentos procesados correctamente en múltiples países.`);
};