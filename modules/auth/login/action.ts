"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import { loginSchema } from "./schema";

export async function loginAction(formData: FormData) {
  try {
    // 1. Extraemos y Validamos estructuralmente los datos antes de inyectar al core
    const rawData = {
      email: formData.get("email"),
      password: formData.get("password"),
    };

    const validatedFields = loginSchema.safeParse(rawData);

    if (!validatedFields.success) {
      return { error: "Por favor, completa todos los campos correctamente." };
    }

    const { email, password } = validatedFields.data;

    // 2. Ejecutamos la autenticación. NextAuth se encargará de las redirecciones automáticas.
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/backoffice",
    });
    
  } catch (error) {
    // 3. Control de Errores Específicos de Dominio NextAuth
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return { error: "El correo o la contraseña son incorrectos." };
        default:
          return { error: "Ocurrió un error inesperado al procesar tus datos." };
      }
    }

    // 4. Relanzar el error interno si es de redirección por Next.js
    throw error;
  }
}