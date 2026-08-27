import { prisma } from "@/lib/prisma";

export class AreaActivityRepository {
  async getValidationHistory(departmentCodes: string[], startDate: Date) {
    return await prisma.membershipValidationHistory.findMany({
      where: {
        validation: {
          department: {
            code: { in: departmentCodes },
          },
        },
        createdAt: { gte: startDate },
        userId: { not: null }, 
      },
      include: {
        user: {
          include: { 
              person: true,
              role: true // ✅ AÑADIMOS ESTO: Traemos el rol oficial del sistema
          },
        },
        validation: {
          include: { department: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });
  }
}