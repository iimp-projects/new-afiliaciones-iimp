import { prisma } from '@/lib/prisma';
import { seedLogger, runSeed, SEED_ENV } from '@/lib/seed';

import { seedPermissions, seedRolePermissions } from './seed/index';

const main = async (): Promise<void> => {
  seedLogger.divider();
  seedLogger.info(`Iniciando RBAC Database Seed [ENV: ${SEED_ENV.toUpperCase()}]`);
  seedLogger.divider();

  try {
    await runSeed('Auth: Permissions', seedPermissions);
    await runSeed('Auth: Role-Permissions', seedRolePermissions);

    seedLogger.divider();
    seedLogger.success('Proceso de Seed RBAC finalizado con éxito.');
    seedLogger.divider();
  } catch {
    seedLogger.error('El runner RBAC detuvo el proceso debido a un error crítico.');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
};

main();
