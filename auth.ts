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

        // IMPORTACIÓN DINÁMICA: Importamos limpiamente a través del patrón Barrel (index.ts)
        const { LoginService } = await import("@/modules/auth/login");
        
        return await LoginService.validateCredentials(
          credentials.email as string,
          credentials.password as string
        );
      },
    }),
  ],
});