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
        email: { equals: email, mode: "insensitive" },
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

  async findUserByEmailIncludingDeleted(email: string) {
    return prisma.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true, email: true, deletedAt: true, personId: true },
    });
  }

  async findPersonByDocument(documentNumber: string) {
    return prisma.person.findFirst({
      where: { documentNumber },
      select: { id: true },
    });
  }

  async createUserWithPerson(
    data: CreateUserInput,
    imageUrl: string | undefined,
    hashedPassword: string,
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
          emailVerified: new Date(),
          type: data.userType,
          image: imageUrl,
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

  async reactivateUser(
    userId: number,
    data: CreateUserInput,
    imageUrl: string | undefined,
    hashedPassword: string,
  ) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({
        where: { id: userId },
        select: { personId: true },
      });
      if (!existing) throw new Error("Usuario no encontrado.");
      if (!existing.personId) throw new Error("El usuario eliminado no tiene persona asociada.");

      // Reutiliza la identidad existente (misma persona), actualizando sus datos.
      await tx.person.update({
        where: { id: existing.personId },
        data: {
          documentType: data.documentType,
          documentNumber: data.documentNumber,
          firstName: data.firstName,
          paternalLastName: data.paternalLastName,
          maternalLastName: data.maternalLastName,
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: {
          email: data.email,
          roleId: data.roleId,
          status: UserStatus.ACTIVE,
          deletedAt: null,
          emailVerified: new Date(),
          type: data.userType,
          ...(imageUrl ? { image: imageUrl } : {}),
        },
      });

      const credentialUpdate = await tx.credential.updateMany({
        where: { userId, type: CredentialType.PASSWORD },
        data: { secret: hashedPassword, isActive: true },
      });
      if (credentialUpdate.count === 0) {
        await tx.credential.create({
          data: {
            userId,
            type: CredentialType.PASSWORD,
            secret: hashedPassword,
            isActive: true,
          },
        });
      }

      return tx.user.findUnique({ where: { id: userId } });
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

  async toggleUserStatus(userId: number) {
    return prisma.$transaction(async (tx) => {
      const current = await tx.user.findUnique({ where: { id: userId }, select: { status: true } });
      if (!current) throw new Error("Usuario no encontrado.");

      const newStatus = current.status === UserStatus.ACTIVE ? UserStatus.INACTIVE : UserStatus.ACTIVE;
      const user = await tx.user.update({ where: { id: userId }, data: { status: newStatus } });
      if (newStatus === UserStatus.INACTIVE) {
        const revokedAt = new Date();
        await tx.userSession.updateMany({
          where: { userId, isRevoked: false },
          data: { isRevoked: true, revokedAt, revokeReason: "Usuario desactivado por un administrador." },
        });
      }
      return user;
    });
  }

  async softDeleteUser(userId: number) {
    return prisma.$transaction(async (tx) => {
      const deletedAt = new Date();
      const user = await tx.user.update({
        where: { id: userId },
        data: { deletedAt, status: UserStatus.INACTIVE },
      });
      await tx.userSession.updateMany({
        where: { userId, isRevoked: false },
        data: { isRevoked: true, revokedAt: deletedAt, revokeReason: "Usuario eliminado por un administrador." },
      });
      return user;
    });
  }

  async updateUserPassword(userId: number, hashedPassword: string) {
    return prisma.credential.updateMany({
      where: { 
        userId: userId, 
        type: CredentialType.PASSWORD 
      },
      data: { 
        secret: hashedPassword 
      },
    });
  }

  async setUsersStatus(ids: number[], status: UserStatus): Promise<number[]> {
    if (ids.length === 0) return [];

    return prisma.$transaction(async (tx) => {
      const users = await tx.user.findMany({
        where: { id: { in: ids }, deletedAt: null },
        select: { id: true },
      });
      const processedIds = users.map((user) => user.id);
      if (processedIds.length === 0) return [];

      await tx.user.updateMany({
        where: { id: { in: processedIds } },
        data: { status },
      });

      if (status === UserStatus.INACTIVE) {
        const revokedAt = new Date();
        await tx.userSession.updateMany({
          where: { userId: { in: processedIds }, isRevoked: false },
          data: { isRevoked: true, revokedAt, revokeReason: "Usuario desactivado por un administrador." },
        });
      }

      return processedIds;
    });
  }

  async softDeleteUsers(ids: number[]): Promise<number[]> {
    if (ids.length === 0) return [];

    return prisma.$transaction(async (tx) => {
      const users = await tx.user.findMany({
        where: { id: { in: ids }, deletedAt: null },
        select: { id: true },
      });
      const processedIds = users.map((user) => user.id);
      if (processedIds.length === 0) return [];

      const deletedAt = new Date();
      await tx.user.updateMany({
        where: { id: { in: processedIds } },
        data: { deletedAt, status: UserStatus.INACTIVE },
      });
      await tx.userSession.updateMany({
        where: { userId: { in: processedIds }, isRevoked: false },
        data: { isRevoked: true, revokedAt: deletedAt, revokeReason: "Usuario eliminado por un administrador." },
      });

      return processedIds;
    });
  }
}
