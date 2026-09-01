"use server";

import { revalidatePath } from "next/cache";
import { contextService } from "@/modules/auth/context/service";
import { UserService } from "../Services/UserService";
import { createUserSchema, updateUserSchema } from "../DTOs/user.schema";
import { S3StorageService } from "@/modules/shared/Services/S3StorageService";
import { sessionService } from "@/modules/auth/session/service";

export async function fetchUsersAction(page: number, pageSize: number, search?: string, status?: string, role?: string) {
  try {
    await contextService.requirePermission("read", "users");
    
    const service = new UserService();
    const roleId = role && role !== "ALL" ? Number(role) : undefined;
    
    // Pasamos los nuevos filtros al servicio
    const result = await service.getList(page, pageSize, search, status, roleId);

    const s3Service = new S3StorageService();
    for (const user of result.data) {
      if (user.image) {
        user.image = await s3Service.getPresignedUrl(user.image);
      }
    }

    return result;
  } catch (error: any) {
    throw new Error(error.message || "Error al obtener la lista de usuarios.");
  }
}

export async function createUserAction(prevState: any, formData: FormData) {
  try {
    await contextService.requirePermission("create", "users");
    
    const rawData = Object.fromEntries(formData.entries());
    const validatedData = createUserSchema.safeParse(rawData);
    
    if (!validatedData.success) {
      return { success: false, errors: validatedData.error.flatten().fieldErrors };
    }

    // Ya no usamos S3 aquí. Recibimos la URL en texto plano desde el cliente.
    const imageUrl = formData.get("imageUrl") as string | undefined;

    const service = new UserService();
    await service.createUser(validatedData.data, imageUrl);
    
    revalidatePath("/intranet/security/users");
    return { success: true, message: "Usuario creado correctamente." };
  } catch (error: any) {
    if (error.code === 'P2002') return { success: false, message: "El documento o correo ya existen en el sistema." };
    return { success: false, message: error.message || "Error interno al crear el usuario." };
  }
}

export async function updateUserAction(prevState: any, formData: FormData) {
  try {
    await contextService.requirePermission("update", "users");
    
    const rawData = Object.fromEntries(formData.entries());
    const validatedData = updateUserSchema.safeParse(rawData);
    
    if (!validatedData.success) {
      return { success: false, errors: validatedData.error.flatten().fieldErrors };
    }

    // Ya no usamos S3 aquí. Recibimos la URL en texto plano desde el cliente.
    const imageUrl = formData.get("imageUrl") as string | undefined;

    const service = new UserService();
    await service.updateUser(validatedData.data, imageUrl);
    
    revalidatePath("/intranet/security/users");
    return { success: true, message: "Usuario actualizado correctamente." };
  } catch (error: any) {
    if (error.code === 'P2002') return { success: false, message: "El documento o correo ya existen en el sistema." };
    return { success: false, message: error.message || "Error interno al actualizar el usuario." };
  }
}

export async function toggleUserStatusAction(userId: number, currentStatus: any) {
  try {
    await contextService.requirePermission("update", "users");
    const service = new UserService();
    await service.toggleStatus(userId, currentStatus);
    
    revalidatePath("/intranet/security/users");
    return { success: true, message: "Estado actualizado." };
  } catch (error: any) {
    return { success: false, message: "No se pudo actualizar el estado." };
  }
}

export async function deleteUserAction(userId: number) {
  try {
    await contextService.requirePermission("delete", "users");
    const service = new UserService();
    await service.deleteUser(userId);
    
    revalidatePath("/intranet/security/users");
    return { success: true, message: "Usuario eliminado correctamente." };
  } catch (error: any) {
    return { success: false, message: "No se pudo eliminar el usuario." };
  }
}

// 6. CERRAR SESIONES DEL USUARIO (FORZAR LOGOUT)
export async function revokeUserSessionsAction(userId: number) {
  try {
    await contextService.requirePermission("update", "users");
    
    // Revoca todas las sesiones activas del usuario especificado
    await sessionService.revokeAllSessions(userId, "Sesión cerrada remotamente por el Super Administrador.");
    
    // Revalidamos para reflejar cambios (aunque esto no cambia la UI directamente, es buena práctica)
    revalidatePath("/intranet/security/users");
    
    return { success: true, message: "Se han cerrado todas las sesiones del usuario exitosamente." };
  } catch (error: any) {
    return { success: false, message: "No se pudieron cerrar las sesiones del usuario." };
  }
}

export async function changeUserPasswordAction(userId: number, newPasswordPlain: string) {
  try {
    await contextService.requirePermission("update", "users");
    const service = new UserService();
    await service.changeUserPassword(userId, newPasswordPlain);
    
    return { success: true, message: "Contraseña actualizada correctamente." };
  } catch (error: any) {
    return { success: false, message: "No se pudo actualizar la contraseña." };
  }
}