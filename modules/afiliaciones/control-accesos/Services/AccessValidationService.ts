import { resolveCardData } from "@/modules/afiliaciones/carnet/Services/cardData";
import {
  ACCESS_REASON_MESSAGES,
  type AccessCardStatus,
  type AccessIdentityDto,
  type AccessPolicyConfig,
  type AccessReasonCode,
  type AccessSessionSummary,
  type AccessValidationDto,
} from "../Models/access";
import { prismaAccessRepository, type PrismaAccessRepository } from "../Repositories/PrismaAccessRepository";
import { accessPolicyService, evaluateAccessPolicy, type AccessPolicyService } from "./AccessPolicyService";
import { issueAccessTicket } from "../Utils/accessTicket";
import { extractVerificationToken } from "../Utils/accessToken";

export type AccessActor = {
  userId: number;
  canManage: boolean;
  allowedBaseUrls: readonly string[];
};

export type ValidateAccessInput = {
  rawQr?: string;
  personId?: number;
  siteId: number;
  accessPointId: number;
  movementType: "ENTRY" | "EXIT";
  source: "QR_USB" | "QR_CAMERA" | "MANUAL_SEARCH";
};

type Evaluation = {
  result: "ALLOWED" | "DENIED" | "REVIEW_REQUIRED";
  reasonCode: AccessReasonCode;
  person: AccessIdentityDto | null;
  membership: { known: boolean; pendingQuotaCount: number; source: "NEW" | "MIGRATED" | null };
  session: AccessSessionSummary;
};

export type EvaluateInput = {
  personId: number;
  cardStatus: AccessCardStatus;
  site: { id: number; name: string };
  point: { id: number; name: string; movementMode: "ENTRY" | "EXIT" | "BOTH" };
  policy: AccessPolicyConfig;
  movementType: "ENTRY" | "EXIT";
};

export class AccessValidationService {
  public constructor(
    private readonly repo: PrismaAccessRepository = prismaAccessRepository,
    private readonly policies: AccessPolicyService = accessPolicyService,
  ) {}

  public async validate(input: ValidateAccessInput, actor: AccessActor): Promise<AccessValidationDto> {
    const site = await this.repo.findSite(input.siteId);
    const point = await this.repo.findPoint(input.accessPointId);
    const siteSummary = { id: input.siteId, name: site?.name ?? "Sede" };
    const pointSummary = {
      id: input.accessPointId,
      name: point?.name ?? "Punto de acceso",
      movementMode: point?.movementMode ?? ("BOTH" as const),
    };

    const base = {
      person: null,
      card: { status: "NONE" as AccessCardStatus },
      membership: { known: false, pendingQuotaCount: 0, source: null },
      session: { open: false, sessionId: null as number | null, entryAt: null, entryPoint: null },
      site: siteSummary,
      accessPoint: pointSummary,
      movementType: input.movementType,
      ticket: null,
      ticketExpiresAt: null,
    };

    const denied = (reasonCode: AccessReasonCode): AccessValidationDto => ({
      ...base,
      result: "DENIED",
      reasonCode,
      message: ACCESS_REASON_MESSAGES[reasonCode],
    });

    if (!site || !site.isActive) return denied("SITE_INACTIVE");
    if (!point || !point.isActive || point.siteId !== site.id) return denied("POINT_INACTIVE");
    if (
      (input.movementType === "ENTRY" && point.movementMode === "EXIT") ||
      (input.movementType === "EXIT" && point.movementMode === "ENTRY")
    ) {
      return denied("POINT_MODE_MISMATCH");
    }
    if (!actor.canManage && !(await this.repo.isOperatorAssigned(actor.userId, site.id, point.id))) {
      return denied("OPERATOR_NOT_AUTHORIZED");
    }

    const policy = await this.policies.resolve(site.id);

    let personId: number;
    let card: { id: string; personId: number; status: "ISSUED" | "REVOKED" } | null = null;

    if (input.rawQr?.trim()) {
      const token = extractVerificationToken(input.rawQr, actor.allowedBaseUrls);
      if (!token) return denied("TOKEN_INVALID");
      card = await this.repo.findCardByToken(token);
      if (!card) return denied("CARD_NOT_FOUND");
      personId = card.personId;
    } else {
      if (!input.personId) return denied("TOKEN_INVALID");
      if (!policy.allowManualLookup) return denied("MANUAL_LOOKUP_DISABLED");
      personId = input.personId;
      card = await this.repo.findCardByPerson(personId);
    }

    const evaluation = await this.evaluate({
      personId,
      cardStatus: card?.status ?? "NONE",
      site: siteSummary,
      point: pointSummary,
      policy,
      movementType: input.movementType,
    });

    const ticket = evaluation.result !== "DENIED"
      ? issueAccessTicket({
          personId,
          siteId: site.id,
          accessPointId: point.id,
          movementType: input.movementType,
          source: input.source,
          operatorId: actor.userId,
          cardId: card?.id ?? null,
        })
      : null;

    return {
      result: evaluation.result,
      reasonCode: evaluation.reasonCode,
      message: ACCESS_REASON_MESSAGES[evaluation.reasonCode],
      person: evaluation.person,
      card: { status: card?.status ?? "NONE" },
      membership: evaluation.membership,
      session: evaluation.session,
      site: siteSummary,
      accessPoint: pointSummary,
      movementType: input.movementType,
      ticket: ticket?.ticket ?? null,
      ticketExpiresAt: ticket?.expiresAt ?? null,
    };
  }

  public async evaluate(input: EvaluateInput): Promise<Evaluation> {
    const data = await resolveCardData(input.personId);
    const open = await this.repo.findOpenSession(input.personId, input.site.id);

    const person: AccessIdentityDto | null = data.notFound
      ? null
      : {
          id: input.personId,
          fullName: data.name || "—",
          code: data.code,
          category: data.category,
          photoUrl: data.photoUrl,
        };
    const membership = {
      known: Boolean(data.category),
      pendingQuotaCount: data.pendingQuotaCount ?? 0,
      source: data.source,
    };
    const session: AccessSessionSummary = {
      open: Boolean(open),
      sessionId: open?.id ?? null,
      entryAt: open?.entryAt ? open.entryAt.toISOString() : null,
      entryPoint: open?.entryPoint?.name ?? null,
    };

    if (data.notFound) {
      return { result: "DENIED", reasonCode: "CARD_NOT_FOUND", person, membership, session };
    }

    // Una salida nunca se bloquea por estado de credencial o membresía: el
    // sistema no debe obstaculizar la salida de una persona. Solo se exige una
    // sesión abierta; si no existe, se resuelve por vía administrativa.
    if (input.movementType === "EXIT") {
      if (!open) return { result: "REVIEW_REQUIRED", reasonCode: "NO_OPEN_SESSION", person, membership, session };
      return { result: "ALLOWED", reasonCode: "OK", person, membership, session };
    }

    const policyResult = evaluateAccessPolicy({
      policy: input.policy,
      cardStatus: input.cardStatus,
      membershipKnown: membership.known,
      category: data.category,
      pendingQuotaCount: membership.pendingQuotaCount,
    });

    if (policyResult.result === "DENIED") {
      return { ...policyResult, person, membership, session };
    }

    if (open) {
      return { result: "REVIEW_REQUIRED", reasonCode: "ACTIVE_SESSION", person, membership, session };
    }

    return { ...policyResult, person, membership, session };
  }
}

export const accessValidationService = new AccessValidationService();
