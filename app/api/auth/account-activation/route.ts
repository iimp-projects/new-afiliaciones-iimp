import { NextResponse } from "next/server";
import { z } from "zod";
import { AccountActivationError, accountActivationService } from "@/modules/auth/account-activation/service";

const activationSchema = z.object({
  token: z.string().min(32).max(512),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres.").regex(/^(?=.*[A-Z])(?=.*[0-9])/, "Debe contener una letra mayúscula y un número."),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, { path: ["confirmPassword"], message: "Las contraseñas no coinciden." });

export async function POST(request: Request) {
  const parsed = activationSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ message: "Datos de activación inválidos.", errors: parsed.error.flatten().fieldErrors }, { status: 400 });
  try {
    await accountActivationService.consumeActivation(parsed.data.token, parsed.data.password);
    return NextResponse.json({ message: "Tu cuenta fue activada correctamente." });
  } catch (error) {
    if (error instanceof AccountActivationError) return NextResponse.json({ message: "El enlace de activación es inválido, ya fue utilizado o expiró." }, { status: 400 });
    return NextResponse.json({ message: "No se pudo activar la cuenta." }, { status: 500 });
  }
}
