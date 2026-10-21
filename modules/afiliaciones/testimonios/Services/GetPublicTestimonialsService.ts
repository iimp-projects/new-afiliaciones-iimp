import { prisma } from "@/lib/prisma";
import { resolveAffiliatePhoto } from "@/modules/shared/Services/AffiliatePhotoResolver";
import type { PublicTestimonialDTO } from "../DTOs/PublicTestimonialDTO";

export class GetPublicTestimonialsService {
  async execute(): Promise<PublicTestimonialDTO[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const list = await (prisma as any).associateTestimonial.findMany({
      where: { isApproved: true },
      orderBy: [
        { isFeatured: "desc" },
        { displayOrder: "asc" },
        { createdAt: "desc" },
      ],
      include: {
        person: {
          select: {
            user: {
              select: {
                image: true,
              },
            },
            applications: {
              select: {
                documents: {
                  select: {
                    mimeType: true,
                    category: true,
                    fileName: true,
                    fileUrl: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const result: PublicTestimonialDTO[] = [];

    for (const item of list) {
      let resolvedAvatarUrl = item.avatarUrl || "";

      // 1. Si ya cuenta con una foto personalizada oficial (no placeholder de stock), respetarla prioritariamente
      const hasCustomAvatar = Boolean(
        resolvedAvatarUrl &&
        !resolvedAvatarUrl.includes("images.unsplash.com") &&
        !resolvedAvatarUrl.includes("ui-avatars.com")
      );

      // 2. Si no tiene foto personalizada, resolver foto real desde las postulaciones en S3 usando AffiliatePhotoResolver
      if (!hasCustomAvatar && item.person?.applications && item.person.applications.length > 0) {
        try {
          const photoFromApp = await resolveAffiliatePhoto(item.person.applications);
          if (photoFromApp) {
            resolvedAvatarUrl = photoFromApp;
          }
        } catch {
          // Si falla S3 o firma, continuar con fallback
        }
      }

      // 2. Si no hay foto en postulaciones, intentar user.image
      if (!resolvedAvatarUrl && item.person?.user?.image) {
        resolvedAvatarUrl = item.person.user.image;
      }

      // 3. Fallback a avatar con iniciales si aún estuviera vacío
      if (!resolvedAvatarUrl) {
        resolvedAvatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(
          item.fullName
        )}&background=C39254&color=ffffff&bold=true`;
      }

      // IMPORTANTE: documentNumber y personId se omiten intencionalmente para garantizar privacidad pública
      result.push({
        id: item.id,
        nombre: item.fullName,
        categoria: item.category,
        carrera: item.role,
        institucion: item.institution,
        testimonio: item.content,
        avatarUrl: resolvedAvatarUrl,
        destacado: item.isFeatured,
      });
    }

    return result;
  }
}
