// modules/auth/actions/auth.actions.ts
"use server";

import { signIn } from "@/auth"; // Importamos desde la raíz
import { AuthError } from "next-auth";

export async function loginAction(formData: FormData) {
  try {
    const email = formData.get("email");
    const password = formData.get("password");

    if (!email || !password) {
      return { error: "Por favor, completa todos los campos." };
    }

    // Intentamos iniciar sesión. NextAuth redirigirá automáticamente a la ruta correspondiente
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/backoffice", // Redirección por defecto si todo es correcto
    });
    
  } catch (error) {
    // 1. Manejamos los errores controlados de NextAuth (credenciales inválidas, etc.)
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return { error: "El correo o la contraseña son incorrectos." };
        default:
          return { error: "Ocurrió un error inesperado al procesar tus datos." };
      }
    }

    // 2. IMPORTANTE: Si NO es un AuthError, simplemente lo volvemos a lanzar.
    // Esto incluye el "NEXT_REDIRECT" que Next.js genera internamente para cambiar de página.
    // Al lanzarlo aquí (throw), Next.js lo atrapa en el fondo y ejecuta la redirección sin problemas.
    throw error;
  }
}