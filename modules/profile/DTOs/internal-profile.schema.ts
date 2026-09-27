import { z } from "zod";

export const internalProfilePhoneSchema = z
  .string()
  .trim()
  .min(6, "El teléfono debe tener al menos 6 caracteres.")
  .max(50, "El teléfono es demasiado largo.")
  .regex(/^[0-9+()\-\s]+$/, "El teléfono contiene caracteres no permitidos.");

export const internalProfileUpdateSchema = z
  .object({ phone: internalProfilePhoneSchema })
  .strict();

export type InternalProfileUpdateInput = z.infer<typeof internalProfileUpdateSchema>;
