import { prisma } from '@/lib/prisma';
import { seedLogger, runSeed, IS_PRODUCTION, SEED_ENV } from '@/lib/seed';

import {
  seedPermissions,
  seedRoles,
  seedRolePermissions,
  seedCountries,
  seedDepartments,
  seedProvinces,
  seedDistricts,
  seedUniversities,
  seedSpecialties,
  seedAcademicDegrees,
  seedBenefits, 
  seedMembershipDepartments,
  seedAddressTypes,
  seedSystemSettings,
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
    
     await runSeed('Catalogs: Countries', seedCountries);
     await runSeed('Catalogs: Departments', seedDepartments);
     await runSeed('Catalogs: Provinces', seedProvinces);
     await runSeed('Catalogs: Districts', seedDistricts);
     await runSeed('Catalogs: Universities', seedUniversities);    
     await runSeed('Catalogs: Specialties', seedSpecialties);
     await runSeed('Catalogs: Academic Degrees', seedAcademicDegrees);
    // await runSeed('Catalogs: Companies', seedCompanies);
    
    await runSeed('Catalogs: Benefits', seedBenefits);
    await runSeed('Catalogs: Membership Departments', seedMembershipDepartments);
    await runSeed('Catalogs: Address Types', seedAddressTypes);
    await runSeed('System: System Settings', seedSystemSettings);
    // await runSeed('System: Configuration', seedConfiguration);
    

    // 2. MÓDULOS DEVELOPMENT
    if (IS_PRODUCTION) {
      seedLogger.warn('Entorno de Producción detectado. Omitiendo usuarios y datos de prueba.');
    } else {
      seedLogger.info('Inyectando datos de demostración...')
      await runSeed('Auth: Users', seedUsers);
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
