import { describe, expect, it } from "vitest";
import type { CurrentUserDTO } from "@/modules/auth/context/types";
import {
  canAssignPrivilegedRoles,
  canAssignRoleSlug,
  filterAssignableRoles,
  isPrivilegedRoleSlug,
} from "../Policies/UserRoleAssignmentPolicy";

const operator = (permissions: string[]) =>
  ({ permissions: new Set(permissions) }) as Pick<CurrentUserDTO, "permissions">;

describe("UserRoleAssignmentPolicy", () => {
  it("marca SUPER_ADMIN y SYSTEM_ADMIN como roles privilegiados", () => {
    expect(isPrivilegedRoleSlug("SUPER_ADMIN")).toBe(true);
    expect(isPrivilegedRoleSlug("SYSTEM_ADMIN")).toBe(true);
    expect(isPrivilegedRoleSlug("ATENCION_ASOCIADO")).toBe(false);
  });

  it("solo manage:all puede asignar roles privilegiados", () => {
    expect(canAssignPrivilegedRoles(operator(["manage:all"]))).toBe(true);
    expect(canAssignPrivilegedRoles(operator(["create:users"]))).toBe(false);
  });

  it("un rol limitado puede asignar roles no privilegiados", () => {
    const limited = operator(["create:users", "update:users"]);
    expect(canAssignRoleSlug(limited, "ATENCION_ASOCIADO")).toBe(true);
    expect(canAssignRoleSlug(limited, "LOGISTICA")).toBe(true);
  });

  it("un rol limitado no puede asignar SUPER_ADMIN ni SYSTEM_ADMIN", () => {
    const limited = operator(["create:users", "update:users"]);
    expect(canAssignRoleSlug(limited, "SUPER_ADMIN")).toBe(false);
    expect(canAssignRoleSlug(limited, "SYSTEM_ADMIN")).toBe(false);
  });

  it("filtra los roles privilegiados para operadores limitados", () => {
    const roles = [
      { id: 1, name: "Super Administrador", slug: "SUPER_ADMIN" },
      { id: 2, name: "Atención al Asociado", slug: "ATENCION_ASOCIADO" },
      { id: 3, name: "Administrador del Sistema", slug: "SYSTEM_ADMIN" },
    ];
    expect(filterAssignableRoles(operator(["read:users"]), roles)).toEqual([
      { id: 2, name: "Atención al Asociado", slug: "ATENCION_ASOCIADO" },
    ]);
    expect(filterAssignableRoles(operator(["manage:all"]), roles)).toHaveLength(3);
  });
});
