"use server";

import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";
import { loginSchema } from "./schema";
import type { LoginState } from "./types";
import { loginRepository } from "./repository";
import { securityService } from "../security/service";

export async function loginAction(
  prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  try {
    const rawData = Object.fromEntries(formData.entries());
    const validatedFields = loginSchema.safeParse(rawData);

    if (!validatedFields.success) {
      return {
        success: false,
        errors: validatedFields.error.flatten().fieldErrors,
      };
    }

    const { email, password } = validatedFields.data;

    await signIn("credentials", {
      email,
      password,
      redirectTo: "/intranet",
    });

    return { success: true };
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return { success: false, message: "El correo o la contraseña son incorrectos." };
        default:
          return { success: false, message: "Ocurrió un error inesperado." };
      }
    }
    // Relanzar redirecciones de Next.js u otros errores no manejados
    throw error;
  }
}

export async function checkLockStatus(email: string) {
  try {
    const user = await loginRepository.findUserWithPassword(email);
    if (user && securityService.isAccountLocked(user.lockedUntil)) {
      return { 
        locked: true, 
        message: "Demasiados intentos fallidos. La cuenta ha sido bloqueada por 15 minutos." 
      };
    }
    return { locked: false };
  } catch (error) {
    return { locked: false };
  }
}