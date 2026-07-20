import { prisma } from '@/lib/prisma';
import { seedLogger } from '@/lib/seed';

export const seedProvinces = async (): Promise<void> => {
  seedLogger.info('  -> Ejecutando upsert de Provincias...');

  // Referencia segura: Departamento de Lima
  const limaDept = await prisma.department.findUnique({ where: { ubigeoCode: '150000' } });
  
  if (!limaDept) {
    seedLogger.warn('     ⚠️ Departamento de Lima no encontrado. Abortando seed de Provincias.');
    return;
  }

  const provinces = [
    { ubigeoCode: '150100', name: 'Lima' },
    { ubigeoCode: '150200', name: 'Barranca' },
    { ubigeoCode: '150300', name: 'Cajatambo' },
  ];

  for (const prov of provinces) {
    await prisma.province.upsert({
      where: { ubigeoCode: prov.ubigeoCode },
      update: { name: prov.name, departmentId: limaDept.id },
      create: { ubigeoCode: prov.ubigeoCode, name: prov.name, departmentId: limaDept.id },
    });
  }

  seedLogger.success(`  -> ${provinces.length} provincias procesadas correctamente.`);
};