import { prisma } from "@/lib/prisma";
import { UserStatus, CredentialType } from "@prisma/client";
import type { CreateUserInput, UpdateUserInput } from "../DTOs/user.schema";

export class UserRepository {
  
  async getPaginatedUsers(
    page: number,
    pageSize: number,
    search?: string,
    status?: string,
    roleId?: number,
  ) {
    const skip = (page - 1) * pageSize;
    const baseWhere: any = { deletedAt: null };

    // Filtro de búsqueda por texto
    if (search) {
      baseWhere.OR = [
        { email: { contains: search, mode: "insensitive" as const } },
        { person: { documentNumber: { contains: search } } },
        {
          person: {
            firstName: { contains: search, mode: "insensitive" as const },
          },
        },
        {
          person: {
            paternalLastName: {
              contains: search,
              mode: "insensitive" as const,
            },
          },
        },
      ];
    }

    // ✅ NUEVO: Filtro por Estado
    if (status && status !== "ALL") {
      baseWhere.status = status as UserStatus;
    }

    // ✅ NUEVO: Filtro por Rol
    if (roleId && !isNaN(roleId)) {
      baseWhere.roleId = roleId;
    }

    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where: baseWhere,
        skip,
        take: pageSize,
        include: { person: true, role: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.count({ where: baseWhere }),
    ]);

    return { data, total, page, pageSize };
  }

  // ✅ CORRECCIÓN: Manejo correcto del ignoreUserId y ignorePersonId
  async checkExistingUser(
    email: string,
    documentNumber: string,
    ignoreUserId?: number,
  ) {
    const existingEmail = await prisma.user.findFirst({
      where: {
        email,
        ...(ignoreUserId ? { id: { not: ignoreUserId } } : {}),
      },
    });

    // Obtenemos el personId asociado al usuario para ignorarlo en la tabla Person
    let ignorePersonId: number | undefined = undefined;
    if (ignoreUserId) {
      const u = await prisma.user.findUnique({
        where: { id: ignoreUserId },
        select: { personId: true },
      });
      if (u?.personId) ignorePersonId = u.personId;
    }

    const existingDoc = await prisma.person.findFirst({
      where: {
        documentNumber,
        ...(ignorePersonId ? { id: { not: ignorePersonId } } : {}),
      },
    });

    return {
      emailExists: !!existingEmail,
      documentExists: !!existingDoc,
    };
  }

  async createUserWithPerson(
    data: CreateUserInput,
    hashedPassword: string,
    imageUrl?: string,
  ) {
    return prisma.$transaction(async (tx) => {
      const person = await tx.person.upsert({
        where: {
          documentType_documentNumber: {
            documentType: data.documentType,
            documentNumber: data.documentNumber,
          },
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
        },
      });

      const user = await tx.user.create({
        data: {
          email: data.email,
          roleId: data.roleId,
          personId: person.id,
          status: UserStatus.ACTIVE,
          type: data.userType,
          image: imageUrl,
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

  async updateUserWithPerson(data: UpdateUserInput, imageUrl?: string) {
    return prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: data.id },
        include: { person: true },
      });
      if (!user) throw new Error("Usuario no encontrado.");

      await tx.person.update({
        where: { id: user.personId! },
        data: {
          documentType: data.documentType,
          documentNumber: data.documentNumber,
          firstName: data.firstName,
          paternalLastName: data.paternalLastName,
          maternalLastName: data.maternalLastName,
        },
      });

      const updateData: any = {
        email: data.email,
        roleId: data.roleId,
      };

      if (imageUrl) {
        updateData.image = imageUrl;
      }

      return tx.user.update({
        where: { id: data.id },
        data: updateData,
      });
    });
  }

  async toggleUserStatus(userId: number, currentStatus: UserStatus) {
    const newStatus =
      currentStatus === UserStatus.ACTIVE
        ? UserStatus.INACTIVE
        : UserStatus.ACTIVE;
    return prisma.user.update({
      where: { id: userId },
      data: { status: newStatus },
    });
  }

  async softDeleteUser(userId: number) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        deletedAt: new Date(),
        status: UserStatus.INACTIVE,
      },
    });
  }
}
