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
  findByApplicationId(applicationId: number, tx?: AssociateIntegrationTransaction): Promise<AssociateIntegrationRecord | null>;
  markProcessing(applicationId: number, tx?: AssociateIntegrationTransaction): Promise<AssociateIntegrationRecord | null>;
  markSynced(applicationId: number, result: { externalAssociateCode: number; externalMessage?: string; receipt?: { type?: string; serie?: string; number?: string; pdfReference?: string } }, tx?: AssociateIntegrationTransaction): Promise<AssociateIntegrationRecord>;
  markRetryable(applicationId: number, error: AssociateIntegrationError, tx?: AssociateIntegrationTransaction): Promise<AssociateIntegrationRecord>;
  markFailed(applicationId: number, error: AssociateIntegrationError, tx?: AssociateIntegrationTransaction): Promise<AssociateIntegrationRecord>;
  startAttempt(integrationId: number, startedAt: Date): Promise<AssociateIntegrationAttemptRecord>;
  finishAttempt(attemptId: number, outcome: AssociateIntegrationAttemptOutcome, finishedAt: Date): Promise<AssociateIntegrationAttemptRecord>;
  listAdmin(params: { page: number; pageSize: number; status?: AssociateIntegrationStatus; trigger?: AssociateIntegrationTrigger; affiliateType?: "ACTIVE" | "STUDENT"; search?: string; from?: Date; to?: Date }): Promise<{ data: any[]; total: number }>;
  findAdminById(id: number): Promise<any | null>;
  createRetryAudit(data: { userId: number; integrationId: number; result: string }, tx?: AssociateIntegrationTransaction): Promise<void>;
}
