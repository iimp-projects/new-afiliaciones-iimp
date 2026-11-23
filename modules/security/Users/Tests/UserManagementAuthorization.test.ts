import { describe, expect, it } from "vitest";
import { rolePermissionsData } from "@/prisma/seed/auth/data/role-permissions.data";

const hasPermission = (roleSlug: string, action: string, subject: string): boolean => {
  const perms = rolePermissionsData[roleSlug] ?? [];
  if (perms.some(([a, s]) => a === "manage" && s === "all")) return true;
  return perms.some(([a, s]) => a === action && s === subject);
};

describe("Gestión de Usuarios — matriz RBAC", () => {
  it.each([
    ["create", "users"],
    ["read", "users"],
    ["update", "users"],
    ["delete", "users"],
    ["block", "users"],
    ["unlock", "users"],
    ["assign-role", "users"],
  ])("ATENCION_ASOCIADO obtiene %s:%s", (action, subject) => {
    expect(hasPermission("ATENCION_ASOCIADO", action, subject)).toBe(true);
  });

  it("ATENCION_ASOCIADO no obtiene administración de roles ni auditoría", () => {
    expect(hasPermission("ATENCION_ASOCIADO", "read", "roles")).toBe(false);
    expect(hasPermission("ATENCION_ASOCIADO", "assign-permissions", "roles")).toBe(false);
    expect(hasPermission("ATENCION_ASOCIADO", "read", "audit")).toBe(false);
  });

  it("SYSTEM_ADMIN conserva la gestión de usuarios", () => {
    expect(hasPermission("SYSTEM_ADMIN", "create", "users")).toBe(true);
    expect(hasPermission("SYSTEM_ADMIN", "delete", "users")).toBe(true);
  });
});
