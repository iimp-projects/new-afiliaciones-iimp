import { z } from "zod";

export const resetPasswordSchema = z.object({
  email: z.string().email(),
  token: z.string().min(64),
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