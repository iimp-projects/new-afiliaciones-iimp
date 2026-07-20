"use server";

import { headers } from "next/headers";
import { forgotPasswordSchema } from "./schema";
import { ForgotPasswordService } from "./service";
import type { ForgotPasswordState } from "./types";

export async function forgotPasswordAction(
  prevState: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  try {
    const rawEmail = formData.get("email");
    const validatedFields = forgotPasswordSchema.safeParse({ email: rawEmail });

    if (!validatedFields.success) {
      return {
        success: false,
        errors: validatedFields.error.flatten().fieldErrors,
      };
    }

    const reqHeaders = await headers();
    const ipAddress = reqHeaders.get("x-forwarded-for") || "127.0.0.1";

    await ForgotPasswordService.processRecoveryRequest(validatedFields.data.email, ipAddress);

    return {
      success: true,
      message: "Si existe una cuenta asociada a este correo, hemos enviado un enlace de recuperación.",
    };
  } catch (error: any) {
    if (error.message === "RATE_LIMIT_EXCEEDED") {
      return { success: false, message: "Demasiados intentos. Por favor, espera 15 minutos." };
    }
    return { success: false, message: "Ocurrió un error al procesar la solicitud." };
  }
}