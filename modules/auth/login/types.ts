import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('El formato del correo es inválido.'),
  password: z.string().min(1, 'La contraseña es requerida.'),
});

export type LoginInputDTO = z.infer<typeof loginSchema>;

export interface LoginRequestMeta {
  ipAddress?: string | null;
  userAgent?: string | null;
  os?: string | null;
  browser?: string | null;
}