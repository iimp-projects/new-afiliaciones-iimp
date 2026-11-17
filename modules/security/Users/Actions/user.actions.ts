"use server";

import { revalidatePath } from "next/cache";
import { contextService } from "@/modules/auth/context/service";
import { UserService } from "../Services/UserService";
import { createUserSchema, updateUserSchema } from "../DTOs/user.schema";
import { S3StorageService } from "@/modules/shared/Services/S3StorageService";
import { sessionService } from "@/modules/auth/session/service";
import {
  PRIVILEGED_ROLE_SLUGS,
  canAssignPrivilegedRoles,
  canAssignRoleSlug,
} from "../Policies/UserRoleAssignmentPolicy";

const PRIVILEGED_USER_ERROR =
  "No tienes permisos para administrar usuarios con un rol de mayor privilegio.";

async function canManageTargetUser(
  service: UserService,
  operator: Parameters<typeof canAssignPrivilegedRoles>[0],
  userId: number,
): Promise<boolean> {
  if (canAssignPrivilegedRoles(operator)) return true;
  const roleSlug = await service.getUserRoleSlug(userId);
  return roleSlug !== null && canAssignRoleSlug(operator, roleSlug);
}

async function canManageBulkTargets(
  service: UserService,
  operator: Parameters<typeof canAssignPrivilegedRoles>[0],
  userIds: number[],
): Promise<boolean> {
  if (canAssignPrivilegedRoles(operator)) return true;
  const privileged = await service.getPrivilegedUserIds(userIds, [...PRIVILEGED_ROLE_SLUGS]);
  return privileged.length === 0;
}

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
        user.image = await s3Service.getPresignedAvatarUrl(user.image);
      }
    }

    return result;
  } catch (error: any) {
    throw new Error(error.message || "Error al obtener la lista de usuarios.");
  }
}

export async function createUserAction(prevState: any, formData: FormData) {
  try {
    const operator = await contextService.requirePermission("create", "users");
    
    const rawData = Object.fromEntries(formData.entries());
    const validatedData = createUserSchema.safeParse(rawData);
    
    if (!validatedData.success) {
      return { success: false, errors: validatedData.error.flatten().fieldErrors };
    }

    // Ya no usamos S3 aquí. Recibimos la URL en texto plano desde el cliente.
    const imageUrl = formData.get("imageUrl") as string | undefined;

    const service = new UserService();
    const targetRoleSlug = await service.getRoleSlug(validatedData.data.roleId);
    if (!targetRoleSlug) {
      return { success: false, message: "El rol seleccionado no existe." };
    }
    if (!canAssignRoleSlug(operator, targetRoleSlug)) {
      return { success: false, message: "No tienes permisos para asignar el rol seleccionado." };
    }

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
    const operator = await contextService.requirePermission("update", "users");
    
    const rawData = Object.fromEntries(formData.entries());
    const validatedData = updateUserSchema.safeParse(rawData);
    
    if (!validatedData.success) {
      return { success: false, errors: validatedData.error.flatten().fieldErrors };
    }

    // Ya no usamos S3 aquí. Recibimos la URL en texto plano desde el cliente.
    const imageUrl = formData.get("imageUrl") as string | undefined;

    const service = new UserService();
    const currentRoleId = await service.getUserRoleId(validatedData.data.id);
    if (currentRoleId === null) {
      return { success: false, message: "Usuario no encontrado." };
    }
    if (!(await canManageTargetUser(service, operator, validatedData.data.id))) {
      return { success: false, message: PRIVILEGED_USER_ERROR };
    }
    if (currentRoleId !== validatedData.data.roleId) {
      const targetRoleSlug = await service.getRoleSlug(validatedData.data.roleId);
      if (!targetRoleSlug) {
        return { success: false, message: "El rol seleccionado no existe." };
      }
      if (!canAssignRoleSlug(operator, targetRoleSlug)) {
        return { success: false, message: "No tienes permisos para asignar el rol seleccionado." };
      }
    }

    await service.updateUser(validatedData.data, imageUrl);
    
    revalidatePath("/intranet/security/users");
    return { success: true, message: "Usuario actualizado correctamente." };
  } catch (error: any) {
    if (error.code === 'P2002') return { success: false, message: "El documento o correo ya existen en el sistema." };
    return { success: false, message: error.message || "Error interno al actualizar el usuario." };
  }
}

export async function toggleUserStatusAction(userId: number, _currentStatus: unknown) {
  void _currentStatus;
  try {
    const operator = await contextService.requirePermission("update", "users");
    const service = new UserService();
    if (!(await canManageTargetUser(service, operator, userId))) {
      return { success: false, message: PRIVILEGED_USER_ERROR };
    }
    await service.toggleStatus(userId);
    
    revalidatePath("/intranet/security/users");
    return { success: true, message: "Estado actualizado." };
  } catch (error: any) {
    return { success: false, message: "No se pudo actualizar el estado." };
  }
}

export async function deleteUserAction(userId: number) {
  try {
    const operator = await contextService.requirePermission("delete", "users");
    const service = new UserService();
    if (!(await canManageTargetUser(service, operator, userId))) {
      return { success: false, message: PRIVILEGED_USER_ERROR };
    }
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
    const operator = await contextService.requirePermission("update", "users");
    const service = new UserService();
    if (!(await canManageTargetUser(service, operator, userId))) {
      return { success: false, message: PRIVILEGED_USER_ERROR };
    }
    
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
    const operator = await contextService.requirePermission("update", "users");
    const service = new UserService();
    if (!(await canManageTargetUser(service, operator, userId))) {
      return { success: false, message: PRIVILEGED_USER_ERROR };
    }
    await service.changeUserPassword(userId, newPasswordPlain);
    
    return { success: true, message: "Contraseña actualizada correctamente." };
  } catch (error: any) {
    return { success: false, message: "No se pudo actualizar la contraseña." };
  }
}

// 7. ACCIONES MASIVAS (BULK)

export async function bulkBlockUsersAction(userIds: number[]) {
  try {
    const operator = await contextService.requirePermission("update", "users");
    const service = new UserService();
    if (!(await canManageBulkTargets(service, operator, userIds))) {
      return { success: false, message: PRIVILEGED_USER_ERROR };
    }
    const result = await service.bulkBlockUsers(userIds, operator.id);
    revalidatePath("/intranet/security/users");
    return { success: true, ...result };
  } catch (error: any) {
    return { success: false, message: "No se pudo bloquear a los usuarios." };
  }
}

export async function bulkUnblockUsersAction(userIds: number[]) {
  try {
    const operator = await contextService.requirePermission("update", "users");
    const service = new UserService();
    if (!(await canManageBulkTargets(service, operator, userIds))) {
      return { success: false, message: PRIVILEGED_USER_ERROR };
    }
    const result = await service.bulkUnblockUsers(userIds, operator.id);
    revalidatePath("/intranet/security/users");
    return { success: true, ...result };
  } catch (error: any) {
    return { success: false, message: "No se pudo desbloquear a los usuarios." };
  }
}

export async function bulkRevokeSessionsAction(userIds: number[]) {
  try {
    const operator = await contextService.requirePermission("update", "users");
    const service = new UserService();
    if (!(await canManageBulkTargets(service, operator, userIds))) {
      return { success: false, message: PRIVILEGED_USER_ERROR };
    }
    const result = await service.bulkRevokeSessions(userIds, operator.id);
    revalidatePath("/intranet/security/users");
    return { success: true, ...result };
  } catch (error: any) {
    return { success: false, message: "No se pudieron cerrar las sesiones." };
  }
}

export async function bulkDeleteUsersAction(userIds: number[]) {
  try {
    const operator = await contextService.requirePermission("delete", "users");
    const service = new UserService();
    if (!(await canManageBulkTargets(service, operator, userIds))) {
      return { success: false, message: PRIVILEGED_USER_ERROR };
    }
    const result = await service.bulkDeleteUsers(userIds, operator.id);
    revalidatePath("/intranet/security/users");
    return { success: true, ...result };
  } catch (error: any) {
    return { success: false, message: "No se pudieron eliminar los usuarios." };
  }
}
