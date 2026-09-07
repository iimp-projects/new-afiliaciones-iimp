"use server";
/* eslint-disable @typescript-eslint/no-explicit-any -- legacy action contract is consumed by the shared drawer. */

import { prisma } from "@/lib/prisma";
import { contextService } from "@/modules/auth/context/service";
import { S3StorageService } from "@/modules/shared/Services/S3StorageService";
import { ApplicationStatus } from "@prisma/client";

interface FetchAsociadosParams {
  page?: number;
  pageSize?: number;
  search?: string;
  membershipType?: string;
  sort?: string; // ✅ Añadido
}


export async function fetchAsociadosAction(params: FetchAsociadosParams) {
  try {
    await contextService.requirePermission("read", "memberships");

    const { page = 1, pageSize = 12, search, membershipType, sort = "desc" } = params;
    const skip = (page - 1) * pageSize;
    
    const baseWhere: any = { 
        status: ApplicationStatus.COMPLETED,
        deletedAt: null,
    };

    if (search) {
      baseWhere.OR = [
        { email: { contains: search, mode: "insensitive" } },
        { documentNumber: { contains: search } },
        { person: { firstName: { contains: search, mode: "insensitive" } } },
        { person: { paternalLastName: { contains: search, mode: "insensitive" } } }
      ];
    }

    if (membershipType && membershipType !== "ALL") {
      baseWhere.affiliateType = membershipType === "ACTIVE" ? "ACTIVE" : "STUDENT";
    }

    // ✅ Ordenamiento Dinámico
    const orderByConfig = sort === "desc" ? { updatedAt: "desc" as const } : { updatedAt: "asc" as const };

    const [data, total] = await Promise.all([
      prisma.membershipApplication.findMany({
        where: baseWhere,
        skip,
        take: pageSize,
        include: {
          payments: {
            orderBy: { createdAt: "desc" },
            include: { billing: { include: { country: true, invoice: true } } },
          },
          person: {
            include: {
              nationality: true,
              addresses: { include: { district: { include: { province: { include: { department: true } } } } } },
              contacts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
              academicInfos: { include: { specialty: true, university: true, degree: true } },
              employmentInfos: { orderBy: { updatedAt: "desc" }, include: { company: true, position: true } },
              professionalExperiences: { orderBy: [{ isCurrent: "desc" }, { updatedAt: "desc" }], include: { company: true, position: true } },
              applications: {
                where: { deletedAt: null },
                orderBy: { updatedAt: "desc" },
                include: {
                  history: { orderBy: { createdAt: "desc" } },
                  documents: { orderBy: { updatedAt: "desc" } },
                  payments: {
                    orderBy: { createdAt: "desc" },
                    include: { billing: { include: { country: true, invoice: true } } },
                  },
                },
              },
              user: { include: { role: true } },
            }
          },
        },
        orderBy: orderByConfig,
      }),
      prisma.membershipApplication.count({ where: baseWhere })
    ]);

    const dataWithPhoto = await Promise.all(data.map(async (application) => {
      const { person, ...applicationData } = application;
      const safeApplicationData = {
        ...applicationData,
        payments: applicationData.payments.map((payment) => {
          const sanitized = { ...payment, totalAmount: Number(payment.totalAmount) };
          delete sanitized.gatewayPayload;
          return sanitized;
        }),
      };
      return ({
      id: application.id,
      status: person?.user?.status ?? "ACTIVE", email: person?.user?.email ?? application.email, image: person?.user?.image ?? null,
      role: person?.user?.role ?? { slug: application.affiliateType === "STUDENT" ? "ASOCIADO_ESTUDIANTE" : "ASOCIADO_ACTIVO", name: application.affiliateType === "STUDENT" ? "Asociado Estudiante" : "Asociado Activo" },
      createdAt: person?.user?.createdAt ?? application.createdAt, updatedAt: application.updatedAt, lastLoginAt: person?.user?.lastLoginAt ?? null, systemUser: null,
      person: person ? { ...person, applications: [safeApplicationData] } : null,
      affiliateAvatarUrl: await resolveAffiliatePhoto({ image: person?.user?.image ?? null, person: person ? { applications: person.applications } : null }),
    }); }));

    return { success: true, data: dataWithPhoto, total, page, pageSize };
  } catch (error: any) {
    console.error("[Fetch Asociados Error]:", error);
    return { success: false, message: "Error al obtener la lista de asociados.", data: [], total: 0 };
  }
}

async function resolveAffiliatePhoto(user: { image: string | null; person: { applications: Array<{ documents: Array<{ mimeType: string; category: string; fileName: string; fileUrl: string }> }> } | null }) {
  const photo = user.person?.applications.flatMap((application) => application.documents).find((document) => document.mimeType.startsWith("image/") && (document.category === "OTHER" || document.fileName.toLowerCase().includes("foto")));
  if (!photo?.fileUrl) return user.image;
  try {
    return await new S3StorageService().getPresignedUrl(photo.fileUrl);
  } catch {
    return user.image;
  }
}
