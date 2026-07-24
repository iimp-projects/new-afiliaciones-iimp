import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const isAuthenticated = !!req.auth;
  const pathname = req.nextUrl.pathname;

  // Rutas públicas
  const publicRoutes = [
    "/login",
    "/forgot-password",
    "/reset-password",
   "/postulacion",
  ];

  const isPublicRoute = publicRoutes.some((route) =>
    pathname.startsWith(route),
  );

  // Si NO está autenticado y quiere acceder a una ruta protegida
  if (!isAuthenticated && !isPublicRoute) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Si ya inició sesión y vuelve al login
  if (isAuthenticated && pathname === "/login") {
    return NextResponse.redirect(new URL("/intranet", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|.*\\..*).*)",
  ],
};