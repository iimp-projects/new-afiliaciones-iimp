"use server";

import { prisma } from "@/lib/prisma";
import { contextService } from "@/modules/auth/context/service";
import { UserType } from "@prisma/client";

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
        type: UserType.AFFILIATE,
        deletedAt: null,
        status: "ACTIVE" 
    };

    if (search) {
      baseWhere.OR = [
        { email: { contains: search, mode: "insensitive" } },
        { person: { documentNumber: { contains: search } } },
        { person: { firstName: { contains: search, mode: "insensitive" } } },
        { person: { paternalLastName: { contains: search, mode: "insensitive" } } }
      ];
    }

    if (membershipType && membershipType !== "ALL") {
      const expectedSlug = membershipType === "ACTIVE" ? "ASOCIADO_ACTIVO" : "ASOCIADO_ESTUDIANTE";
      baseWhere.role = { slug: expectedSlug };
    }

    // ✅ Ordenamiento Dinámico
    const orderByConfig = sort === "desc" ? { updatedAt: "desc" as const } : { updatedAt: "asc" as const };

    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where: baseWhere,
        skip,
        take: pageSize,
        include: {
          person: {
            include: {
              nationality: true,
              addresses: { include: { district: { include: { province: { include: { department: true } } } } } },
              academicInfos: { include: { specialty: true, university: true } },
              employmentInfos: { include: { company: true, position: true } }
            }
          },
          role: true,
        },
        orderBy: orderByConfig,
      }),
      prisma.user.count({ where: baseWhere })
    ]);

    return { success: true, data, total, page, pageSize };
  } catch (error: any) {
    console.error("[Fetch Asociados Error]:", error);
    return { success: false, message: "Error al obtener la lista de asociados.", data: [], total: 0 };
  }
}