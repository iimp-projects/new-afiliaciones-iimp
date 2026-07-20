"use server";

import { headers } from "next/headers";
import { resetPasswordSchema } from "./schema";
import { ResetPasswordService } from "./service";
import type { ResetPasswordState } from "./types";

export async function resetPasswordAction(
  prevState: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  try {
    const data = Object.fromEntries(formData.entries());
    const validatedFields = resetPasswordSchema.safeParse(data);

    if (!validatedFields.success) {
      return {
        success: false,
        errors: validatedFields.error.flatten().fieldErrors,
      };
    }

    const { email, token, password } = validatedFields.data;
    
    const reqHeaders = await headers();
    const ipAddress = reqHeaders.get("x-forwarded-for") || "127.0.0.1";

    await ResetPasswordService.executeReset(email, token, password, ipAddress);

    return {
      success: true,
      message: "Tu contraseña ha sido actualizada exitosamente.",
    };
  } catch (error: any) {
    if (error.message === "RATE_LIMIT_EXCEEDED") {
      return { success: false, message: "Demasiados intentos. Espera 15 minutos." };
    }
    if (error.message === "INVALID_TOKEN") {
      return { success: false, message: "El enlace es inválido o ha expirado." };
    }
    return { success: false, message: "Error interno del servidor." };
  }
}