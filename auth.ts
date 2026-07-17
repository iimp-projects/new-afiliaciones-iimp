// auth.ts (en la raíz)
import NextAuth from "next-auth";
import { authConfig } from "@/modules/auth/config/auth.config";
import CredentialsProvider from "next-auth/providers/credentials";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    CredentialsProvider({
      name: "credentials",
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        // IMPORTACIÓN DINÁMICA: Esto carga el servicio SOLO cuando el usuario intenta loguearse
        const { AuthService } = await import("@/modules/auth/services/auth.service");
        
        return await AuthService.validateUserCredentials(
          credentials.email as string,
          credentials.password as string
        );
      },
    }),
  ],
});