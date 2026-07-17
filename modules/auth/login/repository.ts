import { prisma } from "@/modules/shared/database/prisma.client";

export const LoginRepository = {
  async findUserByEmail(email: string) {
    return await prisma.user.findUnique({
      where: { email },
      include: {
        role: { 
          include: { 
            rolePermissions: { 
              include: { permission: true } 
            } 
          } 
        },
        person: true
      }
    });
  }
};