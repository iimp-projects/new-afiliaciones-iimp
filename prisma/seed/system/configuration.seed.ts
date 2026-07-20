import { prisma } from '@/lib/prisma';
import { seedLogger } from '@/lib/seed';

export const seedConfiguration = async (): Promise<void> => {
  seedLogger.info('  -> Ejecutando upsert de Configuraciones Globales...');

  const configs = [
    {
      group: 'SECURITY',
      key: 'MAX_FAILED_LOGIN_ATTEMPTS',
      value: '5',
      dataType: 'INTEGER' as const,
      description: 'Límite de intentos antes de bloquear temporalmente la cuenta.',
    },
    {
      group: 'PAYMENTS',
      key: 'DEFAULT_CURRENCY',
      value: 'PEN',
      dataType: 'STRING' as const,
      description: 'Moneda por defecto para las pasarelas de pago.',
    }
  ];

  for (const conf of configs) {
    await prisma.configuration.upsert({
      where: { key: conf.key },
      update: {
        value: conf.value,
        dataType: conf.dataType,
        description: conf.description,
      },
      create: {
        group: conf.group,
        key: conf.key,
        value: conf.value,
        dataType: conf.dataType,
        description: conf.description,
      },
    });
  }

  seedLogger.success(`  -> ${configs.length} configuraciones procesadas correctamente.`);
};