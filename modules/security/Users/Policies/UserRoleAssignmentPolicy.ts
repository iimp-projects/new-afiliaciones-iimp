import type { CurrentUserDTO } from "@/modules/auth/context/types";

export const PRIVILEGED_ROLE_SLUGS = ["SUPER_ADMIN", "SYSTEM_ADMIN"] as const;

type PermissionHolder = Pick<CurrentUserDTO, "permissions">;

export function isPrivilegedRoleSlug(roleSlug: string): boolean {
  return (PRIVILEGED_ROLE_SLUGS as readonly string[]).includes(roleSlug);
}

export function canAssignPrivilegedRoles(operator: PermissionHolder): boolean {
  return operator.permissions.has("manage:all");
}

export function canAssignRoleSlug(
  operator: PermissionHolder,
  targetRoleSlug: string,
): boolean {
  if (!isPrivilegedRoleSlug(targetRoleSlug)) return true;
  return canAssignPrivilegedRoles(operator);
}

export function filterAssignableRoles<T extends { slug?: string }>(
  operator: PermissionHolder,
  roles: T[],
): T[] {
  if (canAssignPrivilegedRoles(operator)) return roles;
  return roles.filter((role) => !isPrivilegedRoleSlug(role.slug ?? ""));
}
