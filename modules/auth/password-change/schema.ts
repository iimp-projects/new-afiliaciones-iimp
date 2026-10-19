import { z } from "zod";

export const changePasswordSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, { message: "La contraseña debe tener al menos 8 caracteres." })
      .regex(/^(?=.*[A-Z])(?=.*[0-9])/, { message: "Debe contener al menos una letra mayúscula y un número." }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Las contraseñas no coinciden.",
    path: ["confirmPassword"],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
