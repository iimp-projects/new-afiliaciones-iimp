import { prisma } from "@/modules/shared/database/prisma.client";
import type { RoleDTO } from "./types";

export const RoleRepository = {
  async findAllActive(): Promise<RoleDTO[]> {
    return await prisma.role.findMany({
      where: { isActive: true, deletedAt: null },
    });
  },

  async findBySlug(slug: string): Promise<RoleDTO | null> {
    return await prisma.role.findUnique({
      where: { slug },
    });
  },
};