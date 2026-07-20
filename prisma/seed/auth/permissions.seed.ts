import { prisma } from '@/lib/prisma';
import { seedLogger } from '@/lib/seed';
import { permissionsData } from './data/permissions.data';

export const seedPermissions = async (): Promise<void> => {
  seedLogger.info('  -> Ejecutando upsert de Permisos (desde permissions.data.ts)...');
  
  let processedCount = 0;

  for (const perm of permissionsData) {
    try {
      await prisma.permission.upsert({
        where: {
          action_subject: {
            action: perm.action,
            subject: perm.subject,
          },
        },
        update: {
          description: perm.description,
        },
        create: {
          action: perm.action,
          subject: perm.subject,
          description: perm.description,
          isActive: true,
        },
      });
      processedCount++;
    } catch (error) {
      seedLogger.error(`      [Error] Fallo al procesar permiso: ${perm.action}:${perm.subject}`, error);
    }
  }

  seedLogger.success(`  -> ${processedCount} permisos procesados correctamente.`);
};