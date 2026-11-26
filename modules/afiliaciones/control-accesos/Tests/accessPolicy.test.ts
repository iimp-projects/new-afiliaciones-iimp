import { describe, expect, it } from "vitest";
import type { AccessPolicyConfig } from "../Models/access";
import { evaluateAccessPolicy } from "../Services/AccessPolicyService";

const policy: AccessPolicyConfig = {
  allowedMembershipCategories: null,
  requireActiveMembership: true,
  requireValidCard: true,
  quotaRestrictionEnabled: false,
  maxPendingQuotas: null,
  allowManualLookup: true,
};

const allowed = { result: "ALLOWED", reasonCode: "OK" } as const;

describe("evaluateAccessPolicy", () => {
  it("permite a un asociado con credencial vigente y membresía conocida", () => {
    expect(
      evaluateAccessPolicy({
        policy,
        cardStatus: "ISSUED",
        membershipKnown: true,
        category: "Asociado Activo",
        pendingQuotaCount: 0,
      }),
    ).toEqual(allowed);
  });

  it("deniega una credencial revocada", () => {
    expect(
      evaluateAccessPolicy({ policy, cardStatus: "REVOKED", membershipKnown: true, category: "Asociado Activo", pendingQuotaCount: 0 }),
    ).toEqual({ result: "DENIED", reasonCode: "CARD_REVOKED" });
  });

  it("deniega cuando no existe credencial y la política la exige", () => {
    expect(
      evaluateAccessPolicy({ policy, cardStatus: "NONE", membershipKnown: true, category: "Asociado Activo", pendingQuotaCount: 0 }),
    ).toEqual({ result: "DENIED", reasonCode: "CARD_NOT_FOUND" });
  });

  it("exige revisión si la membresía no puede determinarse", () => {
    expect(
      evaluateAccessPolicy({ policy, cardStatus: "ISSUED", membershipKnown: false, category: null, pendingQuotaCount: 0 }),
    ).toEqual({ result: "REVIEW_REQUIRED", reasonCode: "MEMBERSHIP_UNKNOWN" });
  });

  it("deniega categorías no autorizadas por la política", () => {
    expect(
      evaluateAccessPolicy({
        policy: { ...policy, allowedMembershipCategories: ["Asociado Activo"] },
        cardStatus: "ISSUED",
        membershipKnown: true,
        category: "Asociado Estudiante",
        pendingQuotaCount: 0,
      }),
    ).toEqual({ result: "DENIED", reasonCode: "CATEGORY_NOT_ALLOWED" });
  });

  it("no bloquea por cuotas si la restricción está deshabilitada (por defecto)", () => {
    expect(
      evaluateAccessPolicy({ policy, cardStatus: "ISSUED", membershipKnown: true, category: "Asociado Activo", pendingQuotaCount: 12 }),
    ).toEqual(allowed);
  });

  it("deniega por cuotas solo si la política lo habilita explícitamente", () => {
    expect(
      evaluateAccessPolicy({
        policy: { ...policy, quotaRestrictionEnabled: true, maxPendingQuotas: 2 },
        cardStatus: "ISSUED",
        membershipKnown: true,
        category: "Asociado Activo",
        pendingQuotaCount: 3,
      }),
    ).toEqual({ result: "DENIED", reasonCode: "QUOTA_RESTRICTED" });
  });

  it("permite búsqueda manual sin credencial si la política no exige tarjeta", () => {
    expect(
      evaluateAccessPolicy({
        policy: { ...policy, requireValidCard: false },
        cardStatus: "NONE",
        membershipKnown: true,
        category: "Asociado Activo",
        pendingQuotaCount: 0,
      }),
    ).toEqual(allowed);
  });
});
