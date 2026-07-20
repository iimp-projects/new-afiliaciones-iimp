// import NextAuth from "next-auth";
// import CredentialsProvider from "next-auth/providers/credentials";
// import { loginService } from "@/modules/auth/login";
// import { AuthenticationError, SecurityError } from "@/modules/auth/errors";

// export const { handlers, auth, signIn, signOut } = NextAuth({
//   pages: {
//     signIn: "/login",
//   },
//   session: {
//     strategy: "jwt",
//     maxAge: 24 * 60 * 60, // 24 horas
//   },
//   providers: [
//     CredentialsProvider({
//       name: "Credentials",
//       credentials: {
//         email: { label: "Email", type: "email" },
//         password: { label: "Password", type: "password" },
//       },
//       async authorize(credentials, request) {
//         if (!credentials?.email || !credentials?.password) {
//           return null;
//         }

//         try {
//           const ipAddress =
//             request?.headers?.get("x-forwarded-for") ||
//             request?.headers?.get("x-real-ip") ||
//             null;
//           const userAgent = request?.headers?.get("user-agent") || null;
//           const os =
//             request?.headers?.get("sec-ch-ua-platform")?.replace(/"/g, "") ||
//             null;
//           const browser = null;

//           const result = await loginService.authenticate(
//             {
//               email: credentials.email as string,
//               password: credentials.password as string,
//             },
//             { ipAddress, userAgent, os, browser },
//           );

//           return { id: result.sessionId };
//         } catch (error) {
//           if (
//             error instanceof AuthenticationError ||
//             error instanceof SecurityError
//           ) {
//             throw error;
//           }
//           return null;
//         }
//       },
//     }),
//   ],
//   callbacks: {
//     async jwt({ token, user }) {
//       if (user?.id) {
//         token.sessionId = user.id;
//       }
//       return token;
//     },
//     async session({ session, token }) {
//       if (token.sessionId) {
//         (session as any).sessionId = token.sessionId;
//       }
//       return session;
//     },
//   },
// });


import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { loginService } from "@/modules/auth/login";
import { AuthenticationError, SecurityError } from "@/modules/auth/errors";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        try {
          // Extraemos los metadatos desde el request expuesto por NextAuth v5
          const ipAddress =
            request?.headers?.get("x-forwarded-for") ||
            request?.headers?.get("x-real-ip") ||
            null;
          const userAgent = request?.headers?.get("user-agent") || null;
          const os =
            request?.headers?.get("sec-ch-ua-platform")?.replace(/"/g, "") ||
            null;
          const browser = null;

          // Delegamos la validación íntegra al LoginService
          const result = await loginService.authenticate(
            {
              email: credentials.email as string,
              password: credentials.password as string,
            },
            { ipAddress, userAgent, os, browser }
          );

          // Retornamos el sessionId mapeado a la propiedad 'id' requerida por Auth.js
          return { id: result.sessionId };
        } catch (error) {
          if (
            error instanceof AuthenticationError ||
            error instanceof SecurityError
          ) {
            throw error;
          }
          return null;
        }
      },
    }),
  ],
});