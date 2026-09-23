import { AssociateIntegrationStatus, Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AssociateIntegrationAttemptOutcome, AssociateIntegrationAttemptRecord, AssociateIntegrationRecord, AssociateRequestPayloadSnapshot } from "../Models/AssociateIntegration";
import type { AssociateIntegrationError, AssociateIntegrationTransaction, IAssociateIntegrationRepository } from "./Interfaces/IAssociateIntegrationRepository";

type Database = PrismaClient | AssociateIntegrationTransaction;

export class AssociateIntegrationRepository implements IAssociateIntegrationRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  async createPendingIfAbsent(input: { applicationId: number; trigger: import("@prisma/client").AssociateIntegrationTrigger; requestPayloadSnapshot: AssociateRequestPayloadSnapshot }, tx?: AssociateIntegrationTransaction): Promise<AssociateIntegrationRecord> {
    try {
      const created = await this.client(tx).associateIntegration.create({ data: { ...input, requestPayloadSnapshot: input.requestPayloadSnapshot as unknown as Prisma.InputJsonValue } });
      return this.toRecord(created);
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
      const existing = await this.findByApplicationId(input.applicationId, tx);
      if (!existing) throw error;
      return existing;
    }
  }

  async createFailedIfAbsent(input: { applicationId: number; trigger: import("@prisma/client").AssociateIntegrationTrigger; requestPayloadSnapshot: AssociateRequestPayloadSnapshot; error: AssociateIntegrationError }, tx?: AssociateIntegrationTransaction): Promise<AssociateIntegrationRecord> {
    try {
      const created = await this.client(tx).associateIntegration.create({ data: {
        applicationId: input.applicationId,
        trigger: input.trigger,
        status: AssociateIntegrationStatus.FAILED,
        requestPayloadSnapshot: input.requestPayloadSnapshot as unknown as Prisma.InputJsonValue,
        lastErrorHttpStatus: input.error.httpStatus,
        lastErrorCode: input.error.code,
        lastErrorMessage: input.error.message,
        lastErrorIdentifier: input.error.identifier,
        lastErrorDetails: input.error.details === undefined ? Prisma.DbNull : input.error.details,
      } });
      return this.toRecord(created);
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
      const existing = await this.findByApplicationId(input.applicationId, tx);
      if (!existing) throw error;
      return existing;
    }
  }

  async findByApplicationId(applicationId: number, tx?: AssociateIntegrationTransaction): Promise<AssociateIntegrationRecord | null> {
    const integration = await this.client(tx).associateIntegration.findUnique({ where: { applicationId } });
    return integration ? this.toRecord(integration) : null;
  }

  async findById(id: number, tx?: AssociateIntegrationTransaction): Promise<AssociateIntegrationRecord | null> {
    const integration = await this.client(tx).associateIntegration.findUnique({ where: { id } });
    return integration ? this.toRecord(integration) : null;
  }

  async markProcessing(applicationId: number, tx?: AssociateIntegrationTransaction): Promise<AssociateIntegrationRecord | null> {
    const updated = await this.client(tx).associateIntegration.updateMany({ where: { applicationId, status: { in: [AssociateIntegrationStatus.PENDING, AssociateIntegrationStatus.RETRYABLE] } }, data: { status: AssociateIntegrationStatus.PROCESSING, attempts: { increment: 1 }, lastAttemptAt: new Date() } });
    return updated.count === 1 ? this.findByApplicationId(applicationId, tx) : null;
  }

  async markSynced(applicationId: number, result: { externalAssociateCode: number; externalMessage?: string; receipt?: { type?: string; serie?: string; number?: string; pdfReference?: string } }, tx?: AssociateIntegrationTransaction): Promise<AssociateIntegrationRecord> {
    const integration = await this.client(tx).associateIntegration.update({ where: { applicationId }, data: { status: AssociateIntegrationStatus.SYNCED, externalAssociateCode: result.externalAssociateCode, externalMessage: result.externalMessage, syncedAt: new Date(), externalReceiptType: result.receipt?.type, externalReceiptSerie: result.receipt?.serie, externalReceiptNumber: result.receipt?.number, externalReceiptPdfReference: result.receipt?.pdfReference, lastErrorHttpStatus: null, lastErrorCode: null, lastErrorMessage: null, lastErrorIdentifier: null, lastErrorDetails: Prisma.DbNull } });
    return this.toRecord(integration);
  }

  async markRetryable(applicationId: number, error: AssociateIntegrationError, tx?: AssociateIntegrationTransaction): Promise<AssociateIntegrationRecord> { return this.updateError(applicationId, AssociateIntegrationStatus.RETRYABLE, error, tx); }
  async markFailed(applicationId: number, error: AssociateIntegrationError, tx?: AssociateIntegrationTransaction): Promise<AssociateIntegrationRecord> { return this.updateError(applicationId, AssociateIntegrationStatus.FAILED, error, tx); }
  async startAttempt(integrationId: number, startedAt: Date): Promise<AssociateIntegrationAttemptRecord> {
    return this.toAttempt(await this.db.$transaction(async (tx) => {
      const latest = await tx.associateIntegrationAttempt.findFirst({ where: { integrationId }, orderBy: { attemptNumber: "desc" }, select: { attemptNumber: true } });
      return tx.associateIntegrationAttempt.create({ data: { integrationId, attemptNumber: (latest?.attemptNumber ?? 0) + 1, startedAt } });
    }));
  }
  async finishAttempt(attemptId: number, outcome: AssociateIntegrationAttemptOutcome, finishedAt: Date): Promise<AssociateIntegrationAttemptRecord> {
    return this.toAttempt(await this.db.associateIntegrationAttempt.update({ where: { id: attemptId }, data: { finishedAt, result: outcome.result, httpStatus: outcome.httpStatus, errorCode: outcome.errorCode, message: outcome.message, errorIdentifier: outcome.errorIdentifier, errorDetails: outcome.errorDetails === undefined ? Prisma.DbNull : outcome.errorDetails, externalAssociateCode: outcome.externalAssociateCode, externalMessage: outcome.externalMessage, durationMs: outcome.durationMs } }));
  }
  async listAdmin(params: { page: number; pageSize: number; status?: import("@prisma/client").AssociateIntegrationStatus; trigger?: import("@prisma/client").AssociateIntegrationTrigger; affiliateType?: "ACTIVE" | "STUDENT"; search?: string; from?: Date; to?: Date }) { const code=Number(params.search); const where: Prisma.AssociateIntegrationWhereInput = { ...(params.status ? { status: params.status } : {}), ...(params.trigger ? { trigger: params.trigger } : {}), ...(params.affiliateType ? { application: { affiliateType: params.affiliateType } } : {}), ...(params.from || params.to ? { createdAt: { ...(params.from ? { gte: params.from } : {}), ...(params.to ? { lte: params.to } : {}) } } : {}), ...(params.search ? { OR: [{ application: { applicationCode: { contains: params.search, mode: "insensitive" } } }, { application: { trackingCode: { contains: params.search, mode: "insensitive" } } }, { application: { person: { is: { firstName: { contains: params.search, mode: "insensitive" } } } } }, { application: { person: { is: { paternalLastName: { contains: params.search, mode: "insensitive" } } } } }, { application: { person: { is: { maternalLastName: { contains: params.search, mode: "insensitive" } } } } }, { application: { person: { is: { documentNumber: { contains: params.search, mode: "insensitive" } } } } }, ...(Number.isInteger(code) ? [{ externalAssociateCode: code }] : [])] } : {}) }; const [data,total]=await Promise.all([this.db.associateIntegration.findMany({where,skip:(params.page-1)*params.pageSize,take:params.pageSize,orderBy:{updatedAt:"desc"},select:{id:true,applicationId:true,trigger:true,status:true,attempts:true,externalAssociateCode:true,lastAttemptAt:true,createdAt:true,application:{select:{applicationCode:true,trackingCode:true,affiliateType:true,person:{select:{firstName:true,paternalLastName:true,maternalLastName:true,documentType:true,documentNumber:true}},payments:{where:{status:"PAID"},orderBy:{paymentDate:"desc"},take:1,select:{billing:{select:{receiptType:true,documentType:true,taxId:true}}}}}}}}),this.db.associateIntegration.count({where})]); return {data,total}; }
  async findAdminById(id: number) { return this.db.associateIntegration.findUnique({where:{id},select:{id:true,applicationId:true,trigger:true,status:true,attempts:true,lastAttemptAt:true,syncedAt:true,createdAt:true,updatedAt:true,externalAssociateCode:true,externalMessage:true,externalReceiptType:true,externalReceiptSerie:true,externalReceiptNumber:true,externalReceiptPdfReference:true,lastErrorHttpStatus:true,lastErrorCode:true,lastErrorMessage:true,lastErrorIdentifier:true,requestPayloadSnapshot:true,attemptHistory:{orderBy:[{attemptNumber:"desc"},{startedAt:"desc"}],select:{attemptNumber:true,startedAt:true,finishedAt:true,result:true,httpStatus:true,errorCode:true,message:true,errorIdentifier:true,externalAssociateCode:true,externalMessage:true,durationMs:true}},application:{select:{applicationCode:true,trackingCode:true,affiliateType:true,person:{select:{firstName:true,paternalLastName:true,maternalLastName:true,documentType:true,documentNumber:true,addresses:{where:{isPrimary:true},take:1,select:{id:true}}}},payments:{where:{status:"PAID"},orderBy:{paymentDate:"desc"},take:1,select:{billing:{select:{receiptType:true,documentType:true,taxId:true,businessName:true,billingAddress:true}}}}}}}}); }
  async createRetryAudit(data: { userId: number; integrationId: number; result: string }, tx?: AssociateIntegrationTransaction) { const current=await this.client(tx).associateIntegration.findUnique({where:{id:data.integrationId},select:{status:true,lastErrorCode:true}}); await this.client(tx).auditLog.create({data:{userId:data.userId,action:"MANUAL_ASSOCIATE_RETRY",entity:"AssociateIntegration",entityId:String(data.integrationId),oldValues:{status:"RETRYABLE"},newValues:{status:current?.status??data.result,errorCode:current?.lastErrorCode??null}}}); }

  private async updateError(applicationId: number, status: AssociateIntegrationStatus, error: AssociateIntegrationError, tx?: AssociateIntegrationTransaction): Promise<AssociateIntegrationRecord> {
    const integration = await this.client(tx).associateIntegration.update({ where: { applicationId }, data: { status, lastErrorHttpStatus: error.httpStatus, lastErrorCode: error.code, lastErrorMessage: error.message, lastErrorIdentifier: error.identifier, lastErrorDetails: error.details === undefined ? Prisma.DbNull : error.details } });
    return this.toRecord(integration);
  }

  private client(tx?: AssociateIntegrationTransaction): Database { return tx ?? this.db; }
  private toRecord(record: any): AssociateIntegrationRecord { return { ...record, requestPayloadSnapshot: record.requestPayloadSnapshot as AssociateRequestPayloadSnapshot }; }
  private toAttempt(record: any): AssociateIntegrationAttemptRecord { return { ...record, errorDetails: record.errorDetails as AssociateIntegrationAttemptRecord["errorDetails"] }; }
}
