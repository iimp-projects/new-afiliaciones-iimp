import { prisma } from '@/lib/prisma';
import { seedLogger, runSeed, IS_PRODUCTION, SEED_ENV } from '@/lib/seed';

import {
  seedPermissions,
  seedRoles,
  seedRolePermissions,
  // seedCountries,
  // seedDepartments,
  // seedProvinces,
  // seedDistricts,
  // seedUniversities,
  // seedSpecialties,
  // seedCompanies,
  // seedConfiguration,
  // seedDemoUsers,
  // seedDemoApplications,
  // seedDemoPayments,
  seedUsers
} from './seed/index';

const main = async (): Promise<void> => {
  seedLogger.divider();
  seedLogger.info(`Iniciando Enterprise Database Seed [ENV: ${SEED_ENV.toUpperCase()}]`);
  seedLogger.divider();

  try {
    // 1. MÓDULOS CORE
    await runSeed('Auth: Permissions', seedPermissions);
    await runSeed('Auth: Roles', seedRoles);
    await runSeed('Auth: Role-Permissions', seedRolePermissions);
    await runSeed('Auth: Users', seedUsers);
    
    // await runSeed('Catalogs: Countries', seedCountries);
    // await runSeed('Catalogs: Departments', seedDepartments);
    // await runSeed('Catalogs: Provinces', seedProvinces);
    // await runSeed('Catalogs: Districts', seedDistricts);
    // await runSeed('Catalogs: Universities', seedUniversities);
    // await runSeed('Catalogs: Specialties', seedSpecialties);
    // await runSeed('Catalogs: Companies', seedCompanies);
    
    // await runSeed('System: Configuration', seedConfiguration);
    

    // 2. MÓDULOS DEVELOPMENT
    if (IS_PRODUCTION) {
      seedLogger.warn('Entorno de Producción detectado. Omitiendo inyección de datos de prueba.');
    } else {
      seedLogger.info('Inyectando datos de demostración...')
      // seedLogger.divider();
      // seedLogger.info('Inyectando datos de demostración para desarrollo local/staging...');
      // seedLogger.divider();
      
      // await runSeed('Dev: Demo Users', seedDemoUsers);
      // await runSeed('Dev: Demo Applications', seedDemoApplications);
      // await runSeed('Dev: Demo Payments', seedDemoPayments);
    }

    seedLogger.divider();
    seedLogger.success('✅ Proceso de Seed finalizado con éxito.');
    seedLogger.divider();
  } catch (error) {
    seedLogger.error('❌ El orquestador detuvo el proceso debido a un error crítico.');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
};

main();