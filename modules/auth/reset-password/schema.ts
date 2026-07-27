import { z } from "zod";

export const resetPasswordSchema = z.object({
  email: z.string().email(),
  // 👇 AQUÍ ESTÁ LA MAGIA: Cambiamos .min(64) por .length(6)
  token: z.string().length(6, { message: "El código de verificación debe tener exactamente 6 dígitos." }),
  password: z
    .string()
    .min(8, { message: "La contraseña debe tener al menos 8 caracteres." })
    .regex(/^(?=.*[A-Z])(?=.*[0-9])/, { message: "Debe contener al menos una letra mayúscula y un número." }),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Las contraseñas no coinciden.",
  path: ["confirmPassword"],
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;