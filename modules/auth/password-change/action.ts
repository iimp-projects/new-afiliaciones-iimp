"use server";

import { getCurrentSession, requireAuth } from "@/modules/auth/context";
import { changePasswordSchema } from "./schema";
import { passwordChangeService } from "./service";

export interface ChangePasswordState {
  success: boolean;
  message?: string;
  errors?: { newPassword?: string[]; confirmPassword?: string[] };
}

export async function changePasswordAction(
  _prevState: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  // El propio flujo de cambio es la única excepción al guard de cambio obligatorio.
  const user = await requireAuth({ allowPasswordChange: true });

  const raw = Object.fromEntries(formData.entries());
  const parsed = changePasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const session = await getCurrentSession();
    await passwordChangeService.execute(user.id, parsed.data.newPassword, session?.id ?? undefined);
    return { success: true, message: "Contraseña actualizada correctamente." };
  } catch (error) {
    if (error instanceof Error && error.message.includes("contraseña histórica")) {
      return { success: false, message: "La nueva contraseña no puede ser igual a la contraseña histórica." };
    }
    return { success: false, message: "No se pudo actualizar la contraseña." };
  }
}
