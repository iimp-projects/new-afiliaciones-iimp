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
});
