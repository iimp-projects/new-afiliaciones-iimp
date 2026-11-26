import { Prisma } from "@prisma/client";
import type { AccessMovementResultDto, AccessReasonCode } from "../Models/access";
import { ACCESS_REASON_MESSAGES } from "../Models/access";
import { prismaAccessRepository, type PrismaAccessRepository } from "../Repositories/PrismaAccessRepository";
import { accessPolicyService, type AccessPolicyService } from "./AccessPolicyService";
import { accessValidationService, type AccessValidationService } from "./AccessValidationService";
import { verifyAccessTicket } from "../Utils/accessTicket";

export type MovementActor = { userId: number; canManage: boolean };

type MovementRow = {
  id: string;
  sessionId: number | null;
  movementType: "ENTRY" | "EXIT";
  occurredAt: Date;
  validationResult: "ALLOWED" | "DENIED" | "REVIEW_REQUIRED";
  reasonCode: string | null;
};

function replays(movement: MovementRow, idempotent: boolean): AccessMovementResultDto {
  return {
    result: movement.validationResult,
    reasonCode: (movement.reasonCode as AccessReasonCode | null) ?? "OK",
    message: idempotent ? ACCESS_REASON_MESSAGES.IDEMPOTENT_REPLAY : ACCESS_REASON_MESSAGES.OK,
    movementId: movement.id,
    sessionId: movement.sessionId,
    movementType: movement.movementType,
    occurredAt: movement.occurredAt.toISOString(),
    idempotent,
  };
}

function failure(reasonCode: AccessReasonCode, movementType: "ENTRY" | "EXIT"): AccessMovementResultDto {
  return {
    result: reasonCode === "SERVICE_ERROR" ? "DENIED" : (reasonCode === "ACTIVE_SESSION" || reasonCode === "NO_OPEN_SESSION" ? "REVIEW_REQUIRED" : "DENIED"),
    reasonCode,
    message: ACCESS_REASON_MESSAGES[reasonCode],
    movementId: null,
    sessionId: null,
    movementType,
    occurredAt: null,
    idempotent: false,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export class AccessMovementService {
  public constructor(
    private readonly repo: PrismaAccessRepository = prismaAccessRepository,
    private readonly validation: AccessValidationService = accessValidationService,
    private readonly policies: AccessPolicyService = accessPolicyService,
  ) {}

  public async checkIn(
    input: { ticket: string; idempotencyKey?: string; adminOverride?: boolean },
    actor: MovementActor,
  ): Promise<AccessMovementResultDto> {
    const verified = verifyAccessTicket(input.ticket);
    if (!verified.ok) return failure(verified.reason === "EXPIRED" ? "TICKET_EXPIRED" : "TICKET_INVALID", "ENTRY");

    const ticket = verified.payload;
    if (ticket.operatorId !== actor.userId || ticket.movementType !== "ENTRY") {
      return failure("TICKET_INVALID", "ENTRY");
    }

    const site = await this.repo.findSite(ticket.siteId);
    const point = await this.repo.findPoint(ticket.accessPointId);
    if (!site || !site.isActive) return failure("SITE_INACTIVE", "ENTRY");
    if (!point || !point.isActive || point.siteId !== site.id) return failure("POINT_INACTIVE", "ENTRY");
    if (point.movementMode === "EXIT") return failure("POINT_MODE_MISMATCH", "ENTRY");
    if (!actor.canManage && !(await this.repo.isOperatorAssigned(actor.userId, site.id, point.id))) {
      return failure("OPERATOR_NOT_AUTHORIZED", "ENTRY");
    }

    const policy = await this.policies.resolve(site.id);
    const card = await this.repo.findCardByPerson(ticket.personId);
    const evaluation = await this.validation.evaluate({
      personId: ticket.personId,
      cardStatus: card?.status ?? "NONE",
      site,
      point,
      policy,
      movementType: "ENTRY",
    });

    if (evaluation.result === "DENIED") return failure(evaluation.reasonCode, "ENTRY");
    const override = Boolean(input.adminOverride && actor.canManage);
    if (evaluation.result === "REVIEW_REQUIRED" && !override) return failure(evaluation.reasonCode, "ENTRY");

    try {
      const result = await this.repo.registerEntry({
        personId: ticket.personId,
        cardId: card?.id ?? null,
        siteId: site.id,
        accessPointId: point.id,
        source: override ? "ADMIN_OVERRIDE" : ticket.source,
        operatorId: actor.userId,
        idempotencyKey: input.idempotencyKey,
        reasonCode: evaluation.reasonCode,
        validationResult: "ALLOWED",
      });
      if (!result.movement) return failure("SERVICE_ERROR", "ENTRY");
      return replays(result.movement, result.reused);
    } catch (error) {
      if (isUniqueViolation(error)) {
        if (input.idempotencyKey) {
          const existing = await this.repo.findMovementByKey(input.idempotencyKey);
          if (existing) return replays(existing, true);
        }
        return failure("ACTIVE_SESSION", "ENTRY");
      }
      throw error;
    }
  }

  public async checkOut(
    input: { ticket: string; idempotencyKey?: string; adminOverride?: boolean; reason?: string },
    actor: MovementActor,
  ): Promise<AccessMovementResultDto> {
    const verified = verifyAccessTicket(input.ticket);
    if (!verified.ok) return failure(verified.reason === "EXPIRED" ? "TICKET_EXPIRED" : "TICKET_INVALID", "EXIT");

    const ticket = verified.payload;
    if (ticket.operatorId !== actor.userId || ticket.movementType !== "EXIT") {
      return failure("TICKET_INVALID", "EXIT");
    }

    const site = await this.repo.findSite(ticket.siteId);
    const point = await this.repo.findPoint(ticket.accessPointId);
    if (!site || !site.isActive) return failure("SITE_INACTIVE", "EXIT");
    if (!point || !point.isActive || point.siteId !== site.id) return failure("POINT_INACTIVE", "EXIT");
    if (point.movementMode === "ENTRY") return failure("POINT_MODE_MISMATCH", "EXIT");
    if (!actor.canManage && !(await this.repo.isOperatorAssigned(actor.userId, site.id, point.id))) {
      return failure("OPERATOR_NOT_AUTHORIZED", "EXIT");
    }

    const override = Boolean(input.adminOverride && actor.canManage);
    const result = await this.repo.registerExit({
      personId: ticket.personId,
      siteId: site.id,
      accessPointId: point.id,
      source: override ? "ADMIN_OVERRIDE" : ticket.source,
      operatorId: actor.userId,
      idempotencyKey: input.idempotencyKey,
      reasonCode: override ? input.reason?.trim() || "ADMINISTRATIVE_EXIT" : "OK",
      administrative: override,
    });

    if (result.movement) return replays(result.movement, result.reused);

    if (override) {
      const administrative = await this.repo.registerAdministrativeExit({
        personId: ticket.personId,
        siteId: site.id,
        accessPointId: point.id,
        operatorId: actor.userId,
        idempotencyKey: input.idempotencyKey,
        reasonCode: input.reason?.trim() || "NO_OPEN_SESSION",
      });
      if (administrative.movement) return { ...replays(administrative.movement, administrative.reused), result: "REVIEW_REQUIRED", reasonCode: "NO_OPEN_SESSION" };
    }

    return failure("NO_OPEN_SESSION", "EXIT");
  }
}

export const accessMovementService = new AccessMovementService();
