// prisma/seed/auth/role-permissions.seed.ts
import { prisma } from '@/lib/prisma';
import { seedLogger, SEED_CONSTANTS } from '@/lib/seed';

export const seedRolePermissions = async (): Promise<void> => {
  seedLogger.info('  -> Ejecutando upsert de Asignación de Permisos a Roles...');

  // 1. Obtener los registros reales de la base de datos para mapear los IDs
  const roles = await prisma.role.findMany();
  const permissions = await prisma.permission.findMany();

  if (roles.length === 0 || permissions.length === 0) {
    seedLogger.warn('     ⚠️ Faltan roles o permisos. Ejecuta seedPermissions y seedRoles primero.');
    return;
  }

  // 2. Identificar los roles específicos por su slug (Constantes inmutables)
  const sysAdminRole = roles.find((r) => r.slug === SEED_CONSTANTS.ROLES.SYSTEM_ADMIN.slug);
  const validatorRole = roles.find((r) => r.slug === SEED_CONSTANTS.ROLES.VALIDATOR.slug);

  let processedCount = 0;

  // 3. Asignar TODOS los permisos disponibles al System Admin
  if (sysAdminRole) {
    for (const perm of permissions) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: sysAdminRole.id,
            permissionId: perm.id,
          },
        },
        update: {}, // No hay atributos adicionales en la tabla pivote
        create: {
          roleId: sysAdminRole.id,
          permissionId: perm.id,
        },
      });
      processedCount++;
    }
  }

  // 4. Asignar permisos específicos al Rol Validador (Revisor de afiliaciones)
  if (validatorRole) {
    // Filtramos solo los permisos sobre "applications" que sean de lectura o validación
    const validatorPerms = permissions.filter(
      (p) => p.subject === 'applications' && ['read', 'approve', 'reject'].includes(p.action)
    );

    for (const perm of validatorPerms) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: validatorRole.id,
            permissionId: perm.id,
          },
        },
        update: {},
        create: {
          roleId: validatorRole.id,
          permissionId: perm.id,
        },
      });
      processedCount++;
    }
  }

  seedLogger.success(`  -> ${processedCount} asignaciones de rol-permiso procesadas correctamente.`);
};