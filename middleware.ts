import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

// Instanciamos el interceptor Auth exclusivamente con la configuración segura (Edge Safe)
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  // Ignoramos rutas públicas, estáticos y páginas de autenticación
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|login|forgot-password|reset-password).*)",
  ],
};