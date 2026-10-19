import { describe, expect, it } from "vitest";
import { isPublicRoute, PUBLIC_ROUTE_PREFIXES } from "./public-routes";

describe("isPublicRoute", () => {
  it("permite la activación de cuenta sin sesión", () => {
    expect(isPublicRoute("/activar-cuenta")).toBe(true);
    expect(PUBLIC_ROUTE_PREFIXES).toContain("/activar-cuenta");
  });

  it("mantiene las rutas públicas existentes", () => {
    for (const route of ["/login", "/forgot-password", "/reset-password", "/postulacion", "/afiliaciones", "/beneficios", "/consulta", "/sap"]) {
      expect(isPublicRoute(route)).toBe(true);
    }
  });

  it("no expone rutas internas ni APIs", () => {
    expect(isPublicRoute("/intranet")).toBe(false);
    expect(isPublicRoute("/intranet/mi-cuenta")).toBe(false);
    expect(isPublicRoute("/api/afiliaciones/expedientes")).toBe(false);
    expect(isPublicRoute("/")).toBe(false);
  });

  it("expone la verificación pública del carnet por segmentos", () => {
    expect(isPublicRoute("/verificar-carnet/token-prueba")).toBe(true);
    expect(isPublicRoute("/verificar-carnet/aaaaaaaaaaaaaaaaaaaaaa")).toBe(true);
    expect(PUBLIC_ROUTE_PREFIXES).toContain("/verificar-carnet");
  });

  it("no expone rutas administrativas del carnet ni prefijos similares", () => {
    expect(isPublicRoute("/api/afiliaciones/carnet/me")).toBe(false);
    expect(isPublicRoute("/api/afiliaciones/carnet/1")).toBe(false);
    expect(isPublicRoute("/api/afiliaciones/carnet/1/revoke")).toBe(false);
    expect(isPublicRoute("/intranet/mi-cuenta/carnet")).toBe(false);
    expect(isPublicRoute("/verificar-carnet-admin")).toBe(false);
    expect(isPublicRoute("/verificar-carnet")).toBe(true);
  });
});
