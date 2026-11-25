import { describe, expect, it } from "vitest";
import { rolePermissionsData } from "@/prisma/seed/auth/data/role-permissions.data";
import { canManageApplicantNotifications } from "../Utils/applicantNotificationPermissions";

function hasPermission(roleSlug: string, action: string, subject: string): boolean {
  const permissions = rolePermissionsData[roleSlug] ?? [];
  if (permissions.some(([a, s]) => a === "manage" && s === "all")) return true;
  return permissions.some(([a, s]) => a === action && s === subject);
}

describe("Autorización de notificación al Comité", () => {
  it("exige update:applications para ejecutar la acción", () => {
    expect(hasPermission("ATENCION_ASOCIADO", "update", "applications")).toBe(true);
    expect(hasPermission("LOGISTICA", "update", "applications")).toBe(true);
    expect(hasPermission("COMITE_EVALUADOR", "update", "applications")).toBe(false);
  });

  it("solo Atención al Asociado y los administradores pueden usar las comunicaciones manuales", () => {
    for (const role of ["ATENCION_ASOCIADO", "SUPER_ADMIN", "SYSTEM_ADMIN"]) {
      expect(canManageApplicantNotifications(role)).toBe(true);
    }
    for (const role of ["LOGISTICA", "LEGAL", "COMUNICACIONES", "COMITE_EVALUADOR"]) {
      expect(canManageApplicantNotifications(role)).toBe(false);
    }
  });

  it("solo Atención al Asociado puede gestionar acceso al portal con update:memberships", () => {
    expect(hasPermission("ATENCION_ASOCIADO", "update", "memberships")).toBe(true);
    for (const role of ["LOGISTICA", "LEGAL", "COMUNICACIONES"]) {
      expect(hasPermission(role, "update", "memberships")).toBe(false);
    }
  });
});
