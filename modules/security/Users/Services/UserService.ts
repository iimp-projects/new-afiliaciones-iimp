import bcrypt from "bcryptjs";
import { UserStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sessionService } from "@/modules/auth/session/service";
import { UserRepository } from "../Repositories/UserRepository";
import type { CreateUserInput, UpdateUserInput } from "../DTOs/user.schema";

const BCRYPT_COST = 12;

export interface BulkUserResult {
  processed: number;
  failed: number;
  message: string;
}

export class UserService {
  private repository = new UserRepository();

  async getList(page: number = 1, pageSize: number = 10, search?: string, status?: string, roleId?: number) {
    return await this.repository.getPaginatedUsers(page, pageSize, search, status, roleId);
  }

  async createUser(input: CreateUserInput, imageUrl?: string) {
    const existingUser = await this.repository.findUserByEmailIncludingDeleted(input.email);
    const documentOwner = await this.repository.findPersonByDocument(input.documentNumber);

    if (!existingUser) {
      if (documentOwner) throw new Error("El número de documento ya se encuentra registrado en el sistema.");
      const hashedPassword = await bcrypt.hash(input.password, BCRYPT_COST);
      return await this.repository.createUserWithPerson(input, imageUrl, hashedPassword);
    }

    // Usuario activo con el mismo correo → se rechaza.
    if (existingUser.deletedAt === null) {
      throw new Error("El correo electrónico ya se encuentra registrado.");
    }

    // El correo pertenece a un usuario eliminado (soft-delete): se reutiliza la identidad
    // existente en lugar de crear un segundo registro con el mismo email.
    if (documentOwner && documentOwner.id !== existingUser.personId) {
      throw new Error("El número de documento ya se encuentra registrado en el sistema.");
    }

    const hashedPassword = await bcrypt.hash(input.password, BCRYPT_COST);
    return await this.repository.reactivateUser(existingUser.id, input, imageUrl, hashedPassword);
  }

  async updateUser(input: UpdateUserInput, imageUrl?: string) {
    const { emailExists, documentExists } = await this.repository.checkExistingUser(input.email, input.documentNumber, input.id);
    
    if (emailExists) throw new Error("El correo electrónico ya está en uso por otro usuario.");
    if (documentExists) throw new Error("El número de documento ya está en uso por otro usuario.");

    return await this.repository.updateUserWithPerson(input, imageUrl);
  }

  async toggleStatus(userId: number) {
    return await this.repository.toggleUserStatus(userId);
  }

  async deleteUser(userId: number) {
    return await this.repository.softDeleteUser(userId);
  }

  async changeUserPassword(userId: number, newPasswordPlain: string) {
    const hashedPassword = await bcrypt.hash(newPasswordPlain, BCRYPT_COST);
    return await this.repository.updateUserPassword(userId, hashedPassword);
  }

  private async runBulk(
    userIds: number[],
    operatorId: number,
    operation: (ids: number[]) => Promise<number[]>,
    action: string,
    processedLabel: string,
  ): Promise<BulkUserResult> {
    const selfIncluded = userIds.includes(operatorId);
    const targetIds = userIds.filter((id) => id !== operatorId);

    const affectedIds = targetIds.length > 0 ? await operation(targetIds) : [];

    const affectedSet = new Set(affectedIds);
    const notFoundCount = targetIds.filter((id) => !affectedSet.has(id)).length;
    const failed = notFoundCount + (selfIncluded ? 1 : 0);

    try {
      await prisma.auditLog.create({
        data: {
          userId: operatorId,
          action,
          entity: "User",
          entityId: "BULK",
          newValues: { requestedIds: userIds, affectedIds },
        },
      });
    } catch {
      // La auditoría no debe romper la operación.
    }

    const message =
      failed > 0
        ? `${affectedIds.length} ${processedLabel}. ${failed} no pudo procesarse.`
        : `${affectedIds.length} ${processedLabel} correctamente.`;

    return { processed: affectedIds.length, failed, message };
  }

  async bulkBlockUsers(userIds: number[], operatorId: number): Promise<BulkUserResult> {
    return this.runBulk(userIds, operatorId, (ids) => this.repository.setUsersStatus(ids, UserStatus.INACTIVE), "USERS_BULK_BLOCK", "usuarios bloqueados");
  }

  async bulkUnblockUsers(userIds: number[], operatorId: number): Promise<BulkUserResult> {
    return this.runBulk(userIds, operatorId, (ids) => this.repository.setUsersStatus(ids, UserStatus.ACTIVE), "USERS_BULK_UNBLOCK", "usuarios desbloqueados");
  }

  async bulkDeleteUsers(userIds: number[], operatorId: number): Promise<BulkUserResult> {
    return this.runBulk(userIds, operatorId, (ids) => this.repository.softDeleteUsers(ids), "USERS_BULK_DELETE", "usuarios eliminados");
  }

  async bulkRevokeSessions(userIds: number[], operatorId: number): Promise<BulkUserResult> {
    const selfIncluded = userIds.includes(operatorId);
    const targetIds = userIds.filter((id) => id !== operatorId);

    for (const id of targetIds) {
      await sessionService.revokeAllSessions(id, "Sesión cerrada por un administrador.");
    }

    try {
      await prisma.auditLog.create({
        data: {
          userId: operatorId,
          action: "USERS_BULK_SESSION_REVOKE",
          entity: "User",
          entityId: "BULK",
          newValues: { requestedIds: userIds, affectedIds: targetIds },
        },
      });
    } catch {
      // La auditoría no debe romper la operación.
    }

    const failed = selfIncluded ? 1 : 0;
    const message =
      failed > 0
        ? `${targetIds.length} usuarios procesados. ${failed} no pudo procesarse.`
        : `${targetIds.length} usuarios procesados correctamente.`;

    return { processed: targetIds.length, failed, message };
  }
}
