import type { AccessValidationResult } from "@prisma/client";
import type { AccessCardStatus, AccessPolicyConfig, AccessReasonCode } from "../Models/access";
import { prismaAccessRepository, type PrismaAccessRepository } from "../Repositories/PrismaAccessRepository";

export const DEFAULT_ACCESS_POLICY: AccessPolicyConfig = {
  allowedMembershipCategories: null,
  requireActiveMembership: true,
  requireValidCard: true,
  quotaRestrictionEnabled: false,
  maxPendingQuotas: null,
  allowManualLookup: true,
};

function parseCategories(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const list = value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim());
  return list.length > 0 ? list : null;
}

export function evaluateAccessPolicy(input: {
  policy: AccessPolicyConfig;
  cardStatus: AccessCardStatus;
  membershipKnown: boolean;
  category: string | null;
  pendingQuotaCount: number;
}): { result: AccessValidationResult; reasonCode: AccessReasonCode } {
  const { policy } = input;

  if (policy.requireValidCard) {
    if (input.cardStatus === "REVOKED") return { result: "DENIED", reasonCode: "CARD_REVOKED" };
    if (input.cardStatus === "NONE") return { result: "DENIED", reasonCode: "CARD_NOT_FOUND" };
  }

  // El estado de membresía indeterminado nunca se presenta como autorizado.
  if (!input.membershipKnown) return { result: "REVIEW_REQUIRED", reasonCode: "MEMBERSHIP_UNKNOWN" };

  if (policy.allowedMembershipCategories && input.category) {
    const category = input.category.toLocaleLowerCase("es");
    const allowed = policy.allowedMembershipCategories.some(
      (candidate) => candidate.toLocaleLowerCase("es") === category,
    );
    if (!allowed) return { result: "DENIED", reasonCode: "CATEGORY_NOT_ALLOWED" };
  }

  // Restricción por deuda: deshabilitada por defecto. Solo aplica si la
  // política de la sede lo habilita explícitamente.
  if (
    policy.quotaRestrictionEnabled &&
    policy.maxPendingQuotas !== null &&
    input.pendingQuotaCount > policy.maxPendingQuotas
  ) {
    return { result: "DENIED", reasonCode: "QUOTA_RESTRICTED" };
  }

  return { result: "ALLOWED", reasonCode: "OK" };
}

export class AccessPolicyService {
  public constructor(private readonly repo: PrismaAccessRepository = prismaAccessRepository) {}

  public async resolve(siteId: number): Promise<AccessPolicyConfig> {
    const row = await this.repo.findActivePolicy(siteId);
    if (!row) return DEFAULT_ACCESS_POLICY;
    return {
      allowedMembershipCategories: parseCategories(row.allowedMembershipCategories),
      requireActiveMembership: row.requireActiveMembership,
      requireValidCard: row.requireValidCard,
      quotaRestrictionEnabled: row.quotaRestrictionEnabled,
      maxPendingQuotas: row.maxPendingQuotas,
      allowManualLookup: row.allowManualLookup,
    };
  }
}

export const accessPolicyService = new AccessPolicyService();
