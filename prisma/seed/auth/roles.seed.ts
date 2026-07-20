import { prisma } from '@/lib/prisma';
import { seedLogger } from '@/lib/seed';
import { rolesData } from './data/roles.data';

export const seedRoles = async (): Promise<void> => {
  seedLogger.info('  -> Ejecutando upsert de Roles (desde roles.data.ts)...');
  
  let processedCount = 0;

  for (const role of rolesData) {
    try {
      await prisma.role.upsert({
        where: { slug: role.slug },
        update: {
          name: role.name,
          description: role.description,
          isActive: role.isActive,
        },
        create: {
          name: role.name,
          slug: role.slug,
          description: role.description,
          isActive: role.isActive ?? true,
        },
      });
      processedCount++;
    } catch (error) {
      seedLogger.error(`      [Error] Fallo al procesar rol: ${role.slug}`, error);
    }
  }

  seedLogger.success(`  -> ${processedCount} roles procesados correctamente.`);
};