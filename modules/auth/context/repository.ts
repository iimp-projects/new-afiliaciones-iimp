import { prisma } from '@/lib/prisma';
import type { CurrentUserDTO } from './types';
import { S3StorageService } from '@/modules/shared/Services/S3StorageService'; // ✅ IMPORTAMOS EL SERVICIO DE S3

export class ContextRepository {
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

    // ✅ FIRMAMOS LA URL DE LA IMAGEN SI EXISTE
    let finalImageUrl = user.image;
    if (finalImageUrl) {
      try {
        const s3Service = new S3StorageService();
        finalImageUrl = await s3Service.getPresignedUrl(finalImageUrl);
      } catch (e) {
        console.error("Error al firmar URL del avatar principal", e);
      }
    }

    const permissionsSet = new Set<string>();
    for (const rp of user.role.rolePermissions) {
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