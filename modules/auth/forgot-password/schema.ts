import { z } from "zod";

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, {
      message: "El correo es obligatorio.",
    })
    .email({
      message: "Debe ser un correo electrónico válido.",
    })
    .max(150, {
      message: "El correo es demasiado largo.",
    }),
});