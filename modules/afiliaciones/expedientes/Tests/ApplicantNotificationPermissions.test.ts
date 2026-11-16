import { describe, expect, it } from "vitest";
import { canManageApplicantNotifications } from "../Utils/applicantNotificationPermissions";

describe("canManageApplicantNotifications", () => {
  it.each(["ATENCION_ASOCIADO", "SUPER_ADMIN", "SYSTEM_ADMIN"] as const)(
    "permite %s",
    (roleSlug) => {
      expect(canManageApplicantNotifications(roleSlug)).toBe(true);
    },
  );

  it.each(["LOGISTICA", "LEGAL", "COMUNICACIONES", "COMITE_EVALUADOR", "VALIDADOR", undefined, null, ""] as const)(
    "oculta las acciones para %s",
    (roleSlug) => {
      expect(canManageApplicantNotifications(roleSlug)).toBe(false);
    },
  );

  it("normaliza mayúsculas y espacios", () => {
    expect(canManageApplicantNotifications(" atencion_asociado ")).toBe(true);
  });
});
