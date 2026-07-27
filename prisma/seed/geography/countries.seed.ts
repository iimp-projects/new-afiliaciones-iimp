import { prisma } from '@/lib/prisma';
import { seedLogger } from '@/lib/seed';
import { countriesData } from './data/countries.data';

export const seedCountries = async (): Promise<void> => {
  seedLogger.info('  -> Ejecutando upsert de Países...');

  let processedCount = 0;

  for (const country of countriesData) {
    // Upsert idempotente y seguro usando el ISO Code oficial
    await prisma.country.upsert({
      where: { isoCode: country.isoCode },
      update: { 
        name: country.name, 
        phoneCode: country.phoneCode 
      },
      create: { 
        isoCode: country.isoCode, 
        name: country.name, 
        phoneCode: country.phoneCode, 
        isActive: true 
      },
    });

    processedCount++;
  }

  seedLogger.success(`  -> ${processedCount} países procesados correctamente.`);
};