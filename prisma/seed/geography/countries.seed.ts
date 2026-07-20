// prisma/seed/catalogs/countries.seed.ts
import { prisma } from '@/lib/prisma';
import { seedLogger, SEED_CONSTANTS } from '@/lib/seed';

export const seedCountries = async (): Promise<void> => {
  seedLogger.info('  -> Ejecutando upsert de Países...');

  const countries = [
    {
      isoCode: SEED_CONSTANTS.COUNTRIES.PERU.isoCode,
      name: SEED_CONSTANTS.COUNTRIES.PERU.name,
      phoneCode: SEED_CONSTANTS.COUNTRIES.PERU.phoneCode,
    },
    { isoCode: 'CHL', name: 'Chile', phoneCode: '+56' },
    { isoCode: 'CAN', name: 'Canadá', phoneCode: '+1' },
    { isoCode: 'USA', name: 'Estados Unidos', phoneCode: '+1' },
    { isoCode: 'COL', name: 'Colombia', phoneCode: '+57' },
    { isoCode: 'MEX', name: 'México', phoneCode: '+52' },
  ];

  for (const country of countries) {
    await prisma.country.upsert({
      where: { isoCode: country.isoCode },
      update: {
        name: country.name,
        phoneCode: country.phoneCode,
        // isActive se mantiene sin tocar en el update para no sobreescribir decisiones de BD
      },
      create: {
        isoCode: country.isoCode,
        name: country.name,
        phoneCode: country.phoneCode,
        isActive: true,
      },
    });
  }

  seedLogger.success(`  -> ${countries.length} países procesados correctamente.`);
};