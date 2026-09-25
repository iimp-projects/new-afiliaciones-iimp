import { describe, expect, it } from "vitest";
import { resolveRequiredApplicationPermission } from "../Services/ExpedienteAuthorizationService";
import { rolePermissionsData } from "@/prisma/seed/auth/data/role-permissions.data";

const hasPermission = (roleSlug: string, action: string, subject: string): boolean => {
  const perms = rolePermissionsData[roleSlug] ?? [];
  if (perms.some(([a, s]) => a === "manage" && s === "all")) return true;
  return perms.some(([a, s]) => a === action && s === subject);
};

const canTransition = (roleSlug: string, targetStatus: string): boolean => {
  const action = resolveRequiredApplicationPermission(targetStatus);
  if (!action) return false;
  return hasPermission(roleSlug, action, "applications");
};

describe("resolveRequiredApplicationPermission", () => {
  it("mapea OBSERVED → observe", () => {
    expect(resolveRequiredApplicationPermission("OBSERVED")).toBe("observe");
  });

  it("mapea APPROVED → approve", () => {
    expect(resolveRequiredApplicationPermission("APPROVED")).toBe("approve");
  });

  it("mapea REJECTED → reject", () => {
    expect(resolveRequiredApplicationPermission("REJECTED")).toBe("reject");
  });

  it("mapea PENDING → reopen", () => {
    expect(resolveRequiredApplicationPermission("PENDING")).toBe("reopen");
  });

  it("rechaza RESOLVED (fail-closed)", () => {
    expect(resolveRequiredApplicationPermission("RESOLVED")).toBeNull();
  });

  it("rechaza estado desconocido (fail-closed)", () => {
    expect(resolveRequiredApplicationPermission("UNKNOWN_STATUS")).toBeNull();
  });

  it("rechaza entradas que no son string (fail-closed)", () => {
    expect(resolveRequiredApplicationPermission(undefined)).toBeNull();
    expect(resolveRequiredApplicationPermission(null)).toBeNull();
    expect(resolveRequiredApplicationPermission(123)).toBeNull();
  });

  it("nunca devuelve update como fallback", () => {
    expect(resolveRequiredApplicationPermission("ANYTHING")).not.toBe("update");
  });
});

describe("matriz de autorización por rol", () => {
  const roles = ["ATENCION_ASOCIADO", "LOGISTICA", "LEGAL", "COMUNICACIONES", "COMITE_EVALUADOR", "SUPER_ADMIN"];

  it.each(roles)("%s: OBSERVED permitido", (role) => {
    expect(canTransition(role, "OBSERVED")).toBe(true);
  });

  it.each(roles)("%s: APPROVED permitido", (role) => {
    expect(canTransition(role, "APPROVED")).toBe(true);
  });

  it.each(roles)("%s: REJECTED permitido", (role) => {
    expect(canTransition(role, "REJECTED")).toBe(true);
  });

  it.each(["ATENCION_ASOCIADO", "LOGISTICA", "LEGAL", "COMUNICACIONES", "SUPER_ADMIN"])(
    "%s: PENDING permitido",
    (role) => {
      expect(canTransition(role, "PENDING")).toBe(true);
    },
  );

  it("COMITE_EVALUADOR: PENDING bloqueado (sin reopen)", () => {
    expect(canTransition("COMITE_EVALUADOR", "PENDING")).toBe(false);
  });

  it.each(roles)("%s: RESOLVED rechazado vía /status", (role) => {
    expect(canTransition(role, "RESOLVED")).toBe(false);
  });

  it.each(roles)("%s: estado desconocido rechazado", (role) => {
    expect(canTransition(role, "UNKNOWN_STATUS")).toBe(false);
  });
});

describe("RBAC alineado con el flujo", () => {
  it("ATENCION_ASOCIADO posee observe/approve/reject/reopen sobre applications", () => {
    for (const action of ["observe", "approve", "reject", "reopen"]) {
      expect(hasPermission("ATENCION_ASOCIADO", action, "applications")).toBe(true);
    }
  });

  it("LOGISTICA, LEGAL y COMUNICACIONES poseen reopen sobre applications", () => {
    for (const role of ["LOGISTICA", "LEGAL", "COMUNICACIONES"]) {
      expect(hasPermission(role, "reopen", "applications")).toBe(true);
    }
  });

  it("COMITE_EVALUADOR conserva observe/approve/reject y NO posee update/reopen", () => {
    expect(hasPermission("COMITE_EVALUADOR", "observe", "applications")).toBe(true);
    expect(hasPermission("COMITE_EVALUADOR", "approve", "applications")).toBe(true);
    expect(hasPermission("COMITE_EVALUADOR", "reject", "applications")).toBe(true);
    expect(hasPermission("COMITE_EVALUADOR", "update", "applications")).toBe(false);
    expect(hasPermission("COMITE_EVALUADOR", "reopen", "applications")).toBe(false);
  });
});
