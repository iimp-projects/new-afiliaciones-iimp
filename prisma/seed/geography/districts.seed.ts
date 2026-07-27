import { prisma } from '@/lib/prisma';
import { seedLogger } from '@/lib/seed';
import { districtsData } from './data/districts.data';

export const seedDistricts = async (): Promise<void> => {
  seedLogger.info('  -> Ejecutando upsert de Distritos / Comunas / Nivel 3...');

  // 1. Mapa O(1) de todas las Provincias
  const provinces = await prisma.province.findMany({
    select: { id: true, ubigeoCode: true }
  });
  const provMap = new Map(provinces.map(p => [p.ubigeoCode, p.id]));

  let processedCount = 0;

  for (const dist of districtsData) {
    const provinceId = provMap.get(dist.provinceUbigeo);

    if (!provinceId) {
      seedLogger.warn(`      ⚠️ Provincia no encontrada para Ubigeo: ${dist.provinceUbigeo}. Saltando: ${dist.name}.`);
      continue;
    }

    await prisma.district.upsert({
      where: { ubigeoCode: dist.ubigeoCode },
      update: { name: dist.name, provinceId: provinceId },
      create: { ubigeoCode: dist.ubigeoCode, name: dist.name, provinceId: provinceId, isActive: true },
    });

    processedCount++;
  }

  seedLogger.success(`  -> ${processedCount} distritos (Nivel 3) procesados correctamente.`);
};