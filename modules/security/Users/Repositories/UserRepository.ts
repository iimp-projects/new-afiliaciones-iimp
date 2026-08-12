import { prisma } from "@/lib/prisma";
import { UserStatus, CredentialType } from "@prisma/client";
import type { CreateUserInput } from "../DTOs/user.schema";

export class UserRepository {
  async getPaginatedUsers(page: number, pageSize: number, search?: string) {
    const skip = (page - 1) * pageSize;
    
    // Solo traemos usuarios que NO hayan sido eliminados
    const baseWhere: any = { deletedAt: null };

    if (search) {
      baseWhere.OR = [
        { email: { contains: search, mode: "insensitive" as const } },
        { person: { documentNumber: { contains: search } } },
        { person: { firstName: { contains: search, mode: "insensitive" as const } } },
        { person: { paternalLastName: { contains: search, mode: "insensitive" as const } } }
      ];
    }

    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where: baseWhere,
        skip,
        take: pageSize,
        include: {
          person: true,
          role: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.count({ where: baseWhere })
    ]);

    return { data, total, page, pageSize };
  }

  async checkExistingUser(email: string, documentNumber: string) {
    const existingEmail = await prisma.user.findUnique({ where: { email } });
    const existingDoc = await prisma.person.findFirst({ where: { documentNumber } });
    
    return {
      emailExists: !!existingEmail,
      documentExists: !!existingDoc,
    };
  }

  async createUserWithPerson(data: CreateUserInput, hashedPassword: string) {
    return prisma.$transaction(async (tx) => {
      const person = await tx.person.upsert({
        where: {
          documentType_documentNumber: {
            documentType: data.documentType,
            documentNumber: data.documentNumber,
          }
        },
        update: {
          firstName: data.firstName,
          paternalLastName: data.paternalLastName,
          maternalLastName: data.maternalLastName,
        },
        create: {
          documentType: data.documentType,
          documentNumber: data.documentNumber,
          firstName: data.firstName,
          paternalLastName: data.paternalLastName,
          maternalLastName: data.maternalLastName,
        }
      });

      const user = await tx.user.create({
        data: {
          email: data.email,
          roleId: data.roleId,
          personId: person.id,
          status: UserStatus.ACTIVE,
          type: data.userType,
          emailVerified: new Date(), 
        },
      });

      await tx.credential.create({
        data: {
          userId: user.id,
          type: CredentialType.PASSWORD,
          secret: hashedPassword,
          isActive: true,
        },
      });

      return user;
    });
  }

  async toggleUserStatus(userId: number, currentStatus: UserStatus) {
    const newStatus = currentStatus === UserStatus.ACTIVE ? UserStatus.INACTIVE : UserStatus.ACTIVE;
    return prisma.user.update({
      where: { id: userId },
      data: { status: newStatus }
    });
  }

  // --- NUEVA FUNCIÓN: ELIMINACIÓN LÓGICA ---
  async softDeleteUser(userId: number) {
    return prisma.user.update({
      where: { id: userId },
      data: { 
        deletedAt: new Date(),
        status: UserStatus.INACTIVE // Lo desactivamos también por seguridad
      }
    });
  }
}