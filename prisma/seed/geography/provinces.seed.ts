import { prisma } from '@/lib/prisma';
import { seedLogger } from '@/lib/seed';
import { provincesData } from './data/provinces.data';

export const seedProvinces = async (): Promise<void> => {
  seedLogger.info('  -> Ejecutando upsert de Provincias (Nivel 2)...');

  // 1. Obtenemos TODOS los departamentos en una sola consulta
  const departments = await prisma.department.findMany({
    select: { id: true, ubigeoCode: true }
  });

  // Mapa O(1): Llave = ubigeoCode del departamento, Valor = ID en base de datos
  const deptMap = new Map(departments.map(d => [d.ubigeoCode, d.id]));

  let processedCount = 0;

  for (const prov of provincesData) {
    // 2. Resolvemos el departmentId usando su Ubigeo
    const departmentId = deptMap.get(prov.departmentUbigeo);

    if (!departmentId) {
      seedLogger.warn(`      ⚠️ Departamento no encontrado para Ubigeo: ${prov.departmentUbigeo}. Saltando provincia: ${prov.name}.`);
      continue;
    }

    // 3. Upsert idempotente y seguro
    await prisma.province.upsert({
      where: { ubigeoCode: prov.ubigeoCode },
      update: { 
        name: prov.name, 
        departmentId: departmentId 
      },
      create: { 
        ubigeoCode: prov.ubigeoCode, 
        name: prov.name, 
        departmentId: departmentId, 
        isActive: true 
      },
    });

    processedCount++;
  }

  seedLogger.success(`  -> ${processedCount} provincias procesadas correctamente.`);
};