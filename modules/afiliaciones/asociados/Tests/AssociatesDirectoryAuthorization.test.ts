import { describe, expect, it } from "vitest";
import { rolePermissionsData } from "@/prisma/seed/auth/data/role-permissions.data";
import { permissionsData } from "@/prisma/seed/auth/data/permissions.data";

const hasPermission = (roleSlug: string, action: string, subject: string): boolean => {
  const perms = rolePermissionsData[roleSlug] ?? [];
  if (perms.some(([a, s]) => a === "manage" && s === "all")) return true;
  return perms.some(([a, s]) => a === action && s === subject);
};

describe("Directorio de Asociados — matriz RBAC", () => {
  it("define el permiso read:associates en el catálogo", () => {
    expect(permissionsData.some((p) => p.action === "read" && p.subject === "associates")).toBe(true);
  });

  it("COMITE_EVALUADOR obtiene read:associates", () => {
    expect(hasPermission("COMITE_EVALUADOR", "read", "associates")).toBe(true);
  });

  it("COMITE_EVALUADOR NO obtiene read:memberships", () => {
    expect(hasPermission("COMITE_EVALUADOR", "read", "memberships")).toBe(false);
  });

  it("COMITE_EVALUADOR NO obtiene update:memberships", () => {
    expect(hasPermission("COMITE_EVALUADOR", "update", "memberships")).toBe(false);
  });

  it("ATENCION_ASOCIADO conserva read:associates", () => {
    expect(hasPermission("ATENCION_ASOCIADO", "read", "associates")).toBe(true);
  });

  it("LOGISTICA conserva read:associates", () => {
    expect(hasPermission("LOGISTICA", "read", "associates")).toBe(true);
  });

  it("SUPER_ADMIN conserva acceso por manage:all", () => {
    expect(hasPermission("SUPER_ADMIN", "read", "associates")).toBe(true);
    expect(rolePermissionsData.SUPER_ADMIN).toEqual([["manage", "all"]]);
  });

  it("read:memberships de otros roles permanece intacto", () => {
    expect(hasPermission("ATENCION_ASOCIADO", "read", "memberships")).toBe(true);
    expect(hasPermission("LOGISTICA", "read", "memberships")).toBe(true);
    expect(hasPermission("ASOCIADO_ACTIVO", "read", "memberships")).toBe(true);
    expect(hasPermission("ASOCIADO_ESTUDIANTE", "read", "memberships")).toBe(true);
  });
});
