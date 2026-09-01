import bcrypt from "bcryptjs";
import { UserRepository } from "../Repositories/UserRepository";
import type { CreateUserInput, UpdateUserInput } from "../DTOs/user.schema";

export class UserService {
  private repository = new UserRepository();

 async getList(page: number = 1, pageSize: number = 10, search?: string, status?: string, roleId?: number) {
    return await this.repository.getPaginatedUsers(page, pageSize, search, status, roleId);
  }

  async createUser(input: CreateUserInput, imageUrl?: string) {
    const { emailExists, documentExists } = await this.repository.checkExistingUser(input.email, input.documentNumber);
    
    if (emailExists) throw new Error("El correo electrónico ya se encuentra registrado.");
    if (documentExists) throw new Error("El número de documento ya se encuentra registrado en el sistema.");

    const defaultPassword = "Cambiar123!"; 
    const hashedPassword = await bcrypt.hash(defaultPassword, 12);
    
    return await this.repository.createUserWithPerson(input, hashedPassword, imageUrl);
  }

  async updateUser(input: UpdateUserInput, imageUrl?: string) {
    const { emailExists, documentExists } = await this.repository.checkExistingUser(input.email, input.documentNumber, input.id);
    
    if (emailExists) throw new Error("El correo electrónico ya está en uso por otro usuario.");
    if (documentExists) throw new Error("El número de documento ya está en uso por otro usuario.");

    return await this.repository.updateUserWithPerson(input, imageUrl);
  }

  async toggleStatus(userId: number, currentStatus: any) {
    return await this.repository.toggleUserStatus(userId, currentStatus);
  }

  async deleteUser(userId: number) {
    return await this.repository.softDeleteUser(userId);
  }

  async changeUserPassword(userId: number, newPasswordPlain: string) {
    const hashedPassword = await bcrypt.hash(newPasswordPlain, 12);
    return await this.repository.updateUserPassword(userId, hashedPassword);
  }
}