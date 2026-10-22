import { prisma } from '@/lib/prisma';
import type { CurrentUserDTO } from './types';
import { S3StorageService } from '@/modules/shared/Services/S3StorageService'; // ✅ IMPORTAMOS EL SERVICIO DE S3
import { Prisma, UserStatus } from '@prisma/client';
import { APPLICATION_KEY_PREFIX, LEGACY_DOCUMENT_KEY_PREFIX } from '@/modules/afiliaciones/postulacion/Services/ApplicationDocumentAccess';

type ProfilePhotoDocument = {
  mimeType: string;
  category: string;
  fileName: string;
  fileUrl: string;
};

export class ContextRepository {
  private mustChangePasswordColumnAvailable: boolean | null = null;

  private async hasMustChangePasswordColumn(): Promise<boolean> {
    if (this.mustChangePasswordColumnAvailable !== null) return this.mustChangePasswordColumnAvailable;

    const rows = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
      `SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'auth_users'
          AND column_name = 'must_change_password'
      ) AS "exists"`,
    );
    this.mustChangePasswordColumnAvailable = rows[0]?.exists === true;
    return this.mustChangePasswordColumnAvailable;
  }

  async getHydratedUser(userId: number): Promise<CurrentUserDTO | null> {
    const select = {
      id: true,
      email: true,
      image: true,
      type: true,
      status: true,
      deletedAt: true,
      person: {
        select: {
          firstName: true,
          paternalLastName: true,
          maternalLastName: true,
          documentNumber: true,
          applications: {
            where: { status: "COMPLETED", deletedAt: null },
            orderBy: { updatedAt: 'desc' },
            take: 1,
            select: {
              documents: {
                orderBy: { updatedAt: 'desc' },
                select: { mimeType: true, category: true, fileName: true, fileUrl: true },
              },
            },
          },
        },
      },
      role: {
        select: {
          id: true,
          slug: true,
          isActive: true,
          rolePermissions: {
            select: {
              permission: { select: { isActive: true, action: true, subject: true } },
            },
          },
        },
      },
    } satisfies Prisma.UserSelect;

    const where = { id: userId, status: UserStatus.ACTIVE, deletedAt: null };
    const user = await (await this.hasMustChangePasswordColumn()
      ? prisma.user.findUnique({ where, select: { ...select, mustChangePassword: true } })
      : prisma.user.findUnique({ where, select }));

    if (!user || user.status !== UserStatus.ACTIVE || user.deletedAt || !user.person || !user.role || !user.role.isActive) return null;

    // ✅ FIRMAMOS LA URL DE LA IMAGEN SI EXISTE.
    // El avatar es opcional: si no está autorizado o la firma falla, se
    // devuelve null y la UI usa sus iniciales. No debe romper la autenticación.
    const application = user.person.applications?.[0];
    const applicationPhoto = application?.documents.find((document: ProfilePhotoDocument) =>
      document.mimeType.startsWith('image/') &&
      (document.category === 'OTHER' || document.fileName.toLowerCase().includes('foto')),
    );

    let finalImageUrl: string | null = null;
    if (applicationPhoto?.fileUrl) {
      try {
        finalImageUrl = await new S3StorageService().getPresignedApplicationDocumentUrl(
          applicationPhoto.fileUrl,
          [APPLICATION_KEY_PREFIX, LEGACY_DOCUMENT_KEY_PREFIX],
        );
      } catch {
        finalImageUrl = null;
      }
    }

    if (!finalImageUrl && user.image) {
      try {
        finalImageUrl = await new S3StorageService().getPresignedAvatarUrl(user.image);
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
      mustChangePassword: "mustChangePassword" in user && user.mustChangePassword === true,
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
