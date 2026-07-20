import { prisma } from '@/lib/prisma';
import type { CurrentUserDTO } from './types';

export class ContextRepository {
  /**
   * Obtiene el árbol completo de identidad (User + Person + Role + Permissions).
   */
  async getHydratedUser(userId: number): Promise<CurrentUserDTO | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        person: true,
        role: {
          include: {
            rolePermissions: {
              include: { permission: true },
            },
          },
        },
      },
    });

    if (!user || !user.person || !user.role) return null;

    // Convertimos el array de permisos en un Set<string> para optimizar búsquedas O(1)
    const permissionsSet = new Set<string>();
    for (const rp of user.role.rolePermissions) {
      permissionsSet.add(`${rp.permission.action}:${rp.permission.subject}`);
    }

    return {
      id: user.id,
      email: user.email,
      type: user.type,
      status: user.status,
      person: {
        firstName: user.person.firstName,
        paternalLastName: user.person.paternalLastName,
        maternalLastName: user.person.maternalLastName,
        documentNumber: user.person.documentNumber,
      },
      role: {
        id: user.role.id,
        slug: user.role.slug,
      },
      permissions: permissionsSet,
    };
  }
}

export const contextRepository = new ContextRepository();