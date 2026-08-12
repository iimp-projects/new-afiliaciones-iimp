"use server";

import { prisma } from "@/lib/prisma";
import { contextService } from "@/modules/auth/context/service";

export async function fetchAuditLogsAction(page: number = 1, pageSize: number = 20) {
  try {
    await contextService.requirePermission("read", "audit");

    const skip = (page - 1) * pageSize;

    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({
        skip,
        take: pageSize,
        include: { user: { include: { person: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.auditLog.count()
    ]);

    return { success: true, data, total };
  } catch (error: any) {
    return { success: false, data: [], total: 0 };
  }
}