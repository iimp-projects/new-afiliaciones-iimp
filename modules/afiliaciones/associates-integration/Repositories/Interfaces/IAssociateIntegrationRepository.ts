import type { AssociateIntegrationStatus, AssociateIntegrationTrigger, Prisma } from "@prisma/client";
import type { AssociateIntegrationAttemptOutcome, AssociateIntegrationAttemptRecord, AssociateIntegrationRecord, AssociateRequestPayloadSnapshot } from "../../Models/AssociateIntegration";

export type AssociateIntegrationTransaction = Prisma.TransactionClient;

export type AssociateIntegrationError = {
  httpStatus?: number;
  code?: string;
  message?: string;
  identifier?: string;
  details?: Prisma.InputJsonValue;
};

export interface IAssociateIntegrationRepository {
  createPendingIfAbsent(input: { applicationId: number; trigger: AssociateIntegrationTrigger; requestPayloadSnapshot: AssociateRequestPayloadSnapshot }, tx?: AssociateIntegrationTransaction): Promise<AssociateIntegrationRecord>;
  createFailedIfAbsent(input: { applicationId: number; trigger: AssociateIntegrationTrigger; requestPayloadSnapshot: AssociateRequestPayloadSnapshot; error: AssociateIntegrationError }, tx?: AssociateIntegrationTransaction): Promise<AssociateIntegrationRecord>;
  findById(id: number, tx?: AssociateIntegrationTransaction): Promise<AssociateIntegrationRecord | null>;
  findPreDispatchRecoveryCandidate?(id: number): Promise<{ integration: AssociateIntegrationRecord; attemptHistoryCount: number } | null>;
  findByApplicationId(applicationId: number, tx?: AssociateIntegrationTransaction): Promise<AssociateIntegrationRecord | null>;
  markProcessing(applicationId: number, tx?: AssociateIntegrationTransaction): Promise<AssociateIntegrationRecord | null>;
  /** Atomically freezes the first ACTIVE payload and claims it for dispatch. */
  claimPendingWithFinalizedPayload(applicationId: number, requestPayloadSnapshot: AssociateRequestPayloadSnapshot, tx?: AssociateIntegrationTransaction): Promise<AssociateIntegrationRecord | null>;
  /** Records a pre-dispatch classification failure without creating a POST attempt. */
  markPendingClassificationFailed(applicationId: number, error: AssociateIntegrationError, tx?: AssociateIntegrationTransaction): Promise<AssociateIntegrationRecord | null>;
  markSynced(applicationId: number, result: { externalAssociateCode: number; externalMessage?: string; receipt?: { type?: string; serie?: string; number?: string; pdfReference?: string } }, tx?: AssociateIntegrationTransaction): Promise<AssociateIntegrationRecord>;
  markSyncedByReconciliation(applicationId: number, tx?: AssociateIntegrationTransaction): Promise<AssociateIntegrationRecord>;
  markRetryable(applicationId: number, error: AssociateIntegrationError, tx?: AssociateIntegrationTransaction): Promise<AssociateIntegrationRecord>;
  markFailed(applicationId: number, error: AssociateIntegrationError, tx?: AssociateIntegrationTransaction): Promise<AssociateIntegrationRecord>;
  startAttempt(integrationId: number, startedAt: Date): Promise<AssociateIntegrationAttemptRecord>;
  finishAttempt(attemptId: number, outcome: AssociateIntegrationAttemptOutcome, finishedAt: Date): Promise<AssociateIntegrationAttemptRecord>;
  listAdmin(params: { page: number; pageSize: number; status?: AssociateIntegrationStatus; trigger?: AssociateIntegrationTrigger; affiliateType?: "ACTIVE" | "STUDENT"; search?: string; from?: Date; to?: Date }): Promise<{ data: any[]; total: number }>;
  findAdminById(id: number): Promise<any | null>;
  createRetryAudit(data: { userId: number; integrationId: number; result: string }, tx?: AssociateIntegrationTransaction): Promise<void>;
  resolvePreDispatchRecovery?(data: { integrationId: number; userId: number; originalErrorCode: string | null; legacy: boolean; reconciliation: "ABSENT" | "MATCH" }): Promise<AssociateIntegrationRecord | null>;
}
