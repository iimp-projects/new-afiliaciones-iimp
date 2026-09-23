import { prisma } from '@/lib/prisma';
import type { CurrentUserDTO } from './types';
import { S3StorageService } from '@/modules/shared/Services/S3StorageService'; // ✅ IMPORTAMOS EL SERVICIO DE S3
import { UserStatus } from '@prisma/client';

export class ContextRepository {
  async getHydratedUser(userId: number): Promise<CurrentUserDTO | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId, status: UserStatus.ACTIVE, deletedAt: null },
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

    if (!user || user.status !== UserStatus.ACTIVE || user.deletedAt || !user.person || !user.role || !user.role.isActive) return null;

    // ✅ FIRMAMOS LA URL DE LA IMAGEN SI EXISTE.
    // El avatar es opcional: si no está autorizado o la firma falla, se
    // devuelve null y la UI usa sus iniciales. No debe romper la autenticación.
    let finalImageUrl = user.image;
    if (finalImageUrl) {
      try {
        finalImageUrl = await new S3StorageService().getPresignedAvatarUrl(finalImageUrl);
      } catch {
        finalImageUrl = null;
      }
    }

    const permissionsSet = new Set<string>();
    for (const rp of user.role.rolePermissions) {
      if (!rp.permission.isActive) continue;
      permissionsSet.add(`${rp.permission.action}:${rp.permission.subject}`);
    }

    return {
      id: user.id,
      email: user.email,
      image: finalImageUrl, 
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
