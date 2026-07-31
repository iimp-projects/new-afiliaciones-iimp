import { prisma } from '@/lib/prisma';
import { seedLogger } from '@/lib/seed';
// Importamos la matriz de permisos que ya tienes construida
import { rolePermissionsData } from './data/role-permissions.data';

export const seedRolePermissions = async (): Promise<void> => {
  seedLogger.info('  -> Ejecutando upsert de Asignación de Permisos a Roles...');

  const roles = await prisma.role.findMany();
  const permissions = await prisma.permission.findMany();

  if (roles.length === 0 || permissions.length === 0) {
    seedLogger.warn('       Faltan roles o permisos. Ejecuta seedPermissions y seedRoles primero.');
    return;
  }

  let processedCount = 0;

  // Iteramos sobre todos los roles definidos en tu matriz de datos
  for (const [roleSlug, rolePerms] of Object.entries(rolePermissionsData)) {
    // Buscamos el ID del rol en la base de datos
    const role = roles.find((r) => r.slug === roleSlug);
    
    if (!role) {
      seedLogger.warn(`       Rol no encontrado en DB: ${roleSlug}`);
      continue;
    }

    // Iteramos sobre los permisos [action, subject] asignados a este rol
    for (const [action, subject] of rolePerms) {
      // Buscamos el ID del permiso en la base de datos
      const permission = permissions.find((p) => p.action === action && p.subject === subject);
      
      if (!permission) {
        seedLogger.warn(`       Permiso no encontrado en DB: ${action}:${subject}`);
        continue;
      }

      // Hacemos el upsert en la tabla pivote
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: permission.id,
        },
      });
      processedCount++;
    }
  }

  seedLogger.success(`  -> ${processedCount} asignaciones de rol-permiso procesadas correctamente.`);
};