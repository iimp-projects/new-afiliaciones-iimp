import { describe, expect, it } from "vitest";
import {
  AFFILIATE_PROFILE_ONLY_MODE,
  AFFILIATE_PROFILE_ONLY_ROUTE,
  getAffiliateLandingRoute,
  isAffiliateProfileOnlyItemAllowed,
  isAffiliateProfileOnlyRestrictedRoute,
} from "./affiliate-profile-only";

describe("affiliate-profile-only (R70)", () => {
  it("activa el modo solo perfil", () => {
    expect(AFFILIATE_PROFILE_ONLY_MODE).toBe(true);
    expect(AFFILIATE_PROFILE_ONLY_ROUTE).toBe("/intranet/mi-cuenta/perfil");
  });

  it("solo permite el ítem Mi perfil del menú del asociado", () => {
    expect(isAffiliateProfileOnlyItemAllowed("nav-affiliate-profile")).toBe(true);
    expect(isAffiliateProfileOnlyItemAllowed("nav-affiliate-home")).toBe(false);
    expect(isAffiliateProfileOnlyItemAllowed("nav-affiliate-membership")).toBe(false);
    expect(isAffiliateProfileOnlyItemAllowed("nav-affiliate-payments")).toBe(false);
  });

  it("aterriza al asociado en su perfil en modo solo perfil", () => {
    expect(getAffiliateLandingRoute()).toBe("/intranet/mi-cuenta/perfil");
  });

  it("restringe las secciones del portal salvo el perfil", () => {
    expect(isAffiliateProfileOnlyRestrictedRoute("/intranet/mi-cuenta")).toBe(true);
    expect(isAffiliateProfileOnlyRestrictedRoute("/intranet/mi-cuenta/membresia")).toBe(true);
    expect(isAffiliateProfileOnlyRestrictedRoute("/intranet/mi-cuenta/pagos")).toBe(true);
    expect(isAffiliateProfileOnlyRestrictedRoute("/intranet/mi-cuenta/beneficios")).toBe(true);
    expect(isAffiliateProfileOnlyRestrictedRoute("/intranet/mi-cuenta/eventos")).toBe(true);
    expect(isAffiliateProfileOnlyRestrictedRoute("/intranet/mi-cuenta/documentos")).toBe(true);
    expect(isAffiliateProfileOnlyRestrictedRoute("/intranet/mi-cuenta/soporte")).toBe(true);
  });

  it("permite la ruta de perfil y rutas fuera del portal", () => {
    expect(isAffiliateProfileOnlyRestrictedRoute("/intranet/mi-cuenta/perfil")).toBe(false);
    expect(isAffiliateProfileOnlyRestrictedRoute("/intranet/mi-cuenta/perfil/seccion")).toBe(false);
    expect(isAffiliateProfileOnlyRestrictedRoute("/intranet")).toBe(false);
    expect(isAffiliateProfileOnlyRestrictedRoute("/intranet/expedientes")).toBe(false);
  });
});
