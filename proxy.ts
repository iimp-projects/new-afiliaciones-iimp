import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";
import { isPublicRoute } from "@/lib/security/public-routes";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const isAuthenticated = Boolean(req.auth);
  const pathname = req.nextUrl.pathname;
  const protectedApiPrefixes = [
    "/api/afiliaciones/expedientes",
    "/api/dashboard",
    "/api/security",
    "/api/usuarios/comite",
    "/api/sap",
  ];
  const isProtectedApi = protectedApiPrefixes.some((route) => pathname.startsWith(route));

  if (isProtectedApi && !isAuthenticated) {
    return NextResponse.json({ message: "No autenticado." }, { status: 401 });
  }

  if (pathname.startsWith("/api/")) {
    const response = NextResponse.next();
    response.headers.set("X-Edge-Security", "route-handler-authorization");
    return response;
  }

  if (!isAuthenticated && !isPublicRoute(pathname)) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (isAuthenticated && pathname === "/login") {
    return NextResponse.redirect(new URL("/intranet", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\..*).*)"],
};
