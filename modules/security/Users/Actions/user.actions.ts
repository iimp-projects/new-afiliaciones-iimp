"use server";

import { revalidatePath } from "next/cache";
import { contextService } from "@/modules/auth/context/service";
import { UserService } from "../Services/UserService";
import { createUserSchema } from "../DTOs/user.schema";

// 1. OBTENER USUARIOS
export async function fetchUsersAction(page: number, pageSize: number, search?: string) {
  try {
    await contextService.requirePermission("read", "users");
    const service = new UserService();
    return await service.getList(page, pageSize, search);
  } catch (error: any) {
    throw new Error(error.message || "Error al obtener la lista de usuarios.");
  }
}

// 2. CREAR USUARIO
export async function createUserAction(prevState: any, formData: FormData) {
  try {
    await contextService.requirePermission("create", "users");

    const rawData = Object.fromEntries(formData.entries());
    const validatedData = createUserSchema.safeParse(rawData);

    if (!validatedData.success) {
      return { 
        success: false, 
        errors: validatedData.error.flatten().fieldErrors 
      };
    }

    const service = new UserService();
    await service.createUser(validatedData.data);

    revalidatePath("/intranet/seguridad/usuarios");
    return { success: true, message: "Usuario creado correctamente." };

  } catch (error: any) {
    return { success: false, message: error.message || "Error interno al crear el usuario." };
  }
}

// 3. CAMBIAR ESTADO (Bloquear / Desbloquear)
export async function toggleUserStatusAction(userId: number, currentStatus: any) {
  try {
    await contextService.requirePermission("update", "users");
    
    const service = new UserService();
    await service.toggleStatus(userId, currentStatus);
    
    revalidatePath("/intranet/seguridad/usuarios");
    return { success: true, message: "Estado actualizado." };
  } catch (error: any) {
    return { success: false, message: "No se pudo actualizar el estado." };
  }
}

// 4. ELIMINAR USUARIO (Soft Delete)
export async function deleteUserAction(userId: number) {
  try {
    await contextService.requirePermission("delete", "users");
    
    const service = new UserService();
    await service.deleteUser(userId);
    
    revalidatePath("/intranet/seguridad/usuarios");
    return { success: true, message: "Usuario eliminado correctamente." };
  } catch (error: any) {
    return { success: false, message: "No se pudo eliminar el usuario." };
  }
}