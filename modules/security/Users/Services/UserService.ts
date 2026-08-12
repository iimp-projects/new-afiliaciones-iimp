import bcrypt from "bcryptjs";
import { UserRepository } from "../Repositories/UserRepository";
import type { CreateUserInput } from "../DTOs/user.schema";

export class UserService {
  private repository = new UserRepository();

  async getList(page: number = 1, pageSize: number = 10, search?: string) {
    return await this.repository.getPaginatedUsers(page, pageSize, search);
  }

  async createUser(input: CreateUserInput) {
    const { emailExists, documentExists } = await this.repository.checkExistingUser(input.email, input.documentNumber);
    
    if (emailExists) {
      throw new Error("El correo electrónico ya se encuentra registrado.");
    }
    if (documentExists) {
      throw new Error("El número de documento ya se encuentra registrado en el sistema.");
    }

    const defaultPassword = "Cambiar123!"; 
    const hashedPassword = await bcrypt.hash(defaultPassword, 12);

    return await this.repository.createUserWithPerson(input, hashedPassword);
  }

  async toggleStatus(userId: number, currentStatus: any) {
    return await this.repository.toggleUserStatus(userId, currentStatus);
  }

  // --- NUEVA FUNCIÓN ---
  async deleteUser(userId: number) {
    return await this.repository.softDeleteUser(userId);
  }
}