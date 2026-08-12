"use server";

import { prisma } from "@/lib/prisma";
import { contextService } from "@/modules/auth/context/service";

export async function fetchRolesAction(page: number = 1, pageSize: number = 12, search?: string) {
  try {
    await contextService.requirePermission("read", "roles");

    const skip = (page - 1) * pageSize;
    const where: any = search ? { name: { contains: search, mode: "insensitive" } } : {};

    const [data, total] = await Promise.all([
      prisma.role.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          _count: {
            select: { users: true, rolePermissions: true }
          }
        },
        orderBy: { name: "asc" },
      }),
      prisma.role.count({ where })
    ]);

    return { success: true, data, total, page, pageSize };
  } catch (error: any) {
    return { success: false, message: "Error al obtener roles.", data: [], total: 0 };
  }
}