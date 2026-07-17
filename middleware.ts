// middleware.ts (en la raíz)
import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { BackofficePolicy } from "@/modules/authorization/policies";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const user = req.auth?.user;
  const { nextUrl } = req;
  const path = nextUrl.pathname;

  // 1. Zonas de la aplicación
  const isAuthRoute = path === "/login" || path === "/recuperar-password";
  const isBackofficeRoute = path.startsWith("/backoffice");
  const isIntranetRoute = path.startsWith("/intranet");

  // 2. Manejo de Rutas de Autenticación (Login)
  if (isAuthRoute) {
    if (isLoggedIn) {
      // Delegamos a la Policy para saber a dónde redirigirlo
      const redirectPath = BackofficePolicy.canAccess(user) ? "/backoffice" : "/intranet";
      return NextResponse.redirect(new URL(redirectPath, nextUrl));
    }
    return NextResponse.next();
  }

  // 3. Protección Global para zonas privadas
  if (!isLoggedIn && (isBackofficeRoute || isIntranetRoute)) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  // 4. Aplicación de Políticas (Authorization)
  if (isLoggedIn && isBackofficeRoute) {
    // EL MIDDLEWARE SOLO PREGUNTA, NO JUZGA.
    if (!BackofficePolicy.canAccess(user)) {
      return NextResponse.redirect(new URL("/intranet", nextUrl));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|images).*)"],
};