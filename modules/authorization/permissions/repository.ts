import { prisma } from "@/modules/shared/database/prisma.client";
import type { PermissionDTO } from "./types";

export const PermissionRepository = {
  async findAllActive(): Promise<PermissionDTO[]> {
    return await prisma.permission.findMany({
      where: { isActive: true },
    });
  }
};