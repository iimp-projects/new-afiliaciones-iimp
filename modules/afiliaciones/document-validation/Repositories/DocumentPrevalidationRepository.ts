import { Prisma, type ApplicationStatus, type AffiliateType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { documentExtractionSchema, type DocumentExtraction } from "../Models/DocumentExtraction";
import type {
  PrevalidationResultStatus,
  RuleEvaluationDTO,
} from "../Models/DocumentPrevalidationDTO";
import type { ApplicantAcademicContext } from "../Services/AcademicDocumentRules";

export interface DocumentApplicationContext {
  readonly id: number;
  readonly affiliateType: AffiliateType;
  readonly status: ApplicationStatus;
  readonly applicant: ApplicantAcademicContext;
}

export interface CreateProcessingInput {
  readonly applicationId: number;
  readonly fileUrl: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly fileHash: string;
  readonly extractionSchemaVersion: string;
  readonly promptVersion: string;
  readonly rulesVersion: string;
  readonly staleMs: number;
}

export interface ReusableExtractionQuery {
  readonly applicationId: number;
  readonly fileHash: string;
  readonly model: string;
  readonly extractionSchemaVersion: string;
  readonly promptVersion: string;
  readonly maxAgeMs: number;
}

export interface ReusableExtractionResult {
  readonly extraction: DocumentExtraction;
  readonly fileUrl: string;
}

export interface CompleteAnalysisInput {
  readonly result: PrevalidationResultStatus;
  readonly extraction: DocumentExtraction;
  readonly applicantContext: ApplicantAcademicContext;
  readonly rules: RuleEvaluationDTO[];
  readonly warnings: string[];
  readonly modelUsed: string;
  readonly modelVersion: string | null;
  readonly tokenUsage: Record<string, number | null> | null;
  readonly attempts: number | null;
  readonly extractionSchemaVersion: string;
  readonly promptVersion: string;
  readonly rulesVersion: string;
  readonly durationMs: number;
  readonly extractionMs: number;
  readonly rulesMs: number;
  readonly cacheHit: boolean;
}

export class PrevalidationInProgressError extends Error {
  public constructor() {
    super("Ya existe un análisis en curso para este documento.");
    this.name = "PrevalidationInProgressError";
  }
}

function fullNameFrom(names: {
  firstName?: string | null;
  paternalLastName?: string | null;
  maternalLastName?: string | null;
} | null | undefined): string | null {
  if (!names) return null;
  const parts = [names.firstName, names.paternalLastName, names.maternalLastName]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);
  return parts.length ? parts.join(" ") : null;
}

function academicField(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function positiveInteger(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Persistencia de análisis documental. No duplica el modelo de documentos
 * existente: registra la trazabilidad del análisis (hash, versiones, reglas,
 * tiempos) ligada al expediente.
 */
export class DocumentPrevalidationRepository {
  public constructor(private readonly db = prisma) {}

  public async findApplicationContext(applicationId: number): Promise<DocumentApplicationContext | null> {
    const application = await this.db.membershipApplication.findFirst({
      where: { id: applicationId, deletedAt: null },
      select: {
        id: true,
        affiliateType: true,
        status: true,
        draftData: true,
        person: {
          select: {
            firstName: true,
            paternalLastName: true,
            maternalLastName: true,
          },
        },
      },
    });
    if (!application) return null;

    const draft = academicField(application.draftData);
    const personal = academicField(draft?.personalInformation);
    const studies = Array.isArray(draft?.academicStudies) ? draft.academicStudies : [];
    const study = academicField(studies[0]);

    const draftFullName = fullNameFrom({
      firstName: typeof personal?.names === "string" ? personal.names : null,
      paternalLastName: typeof personal?.fatherLastName === "string" ? personal.fatherLastName : null,
      maternalLastName: typeof personal?.motherLastName === "string" ? personal.motherLastName : null,
    });
    const personFullName = fullNameFrom(application.person);

    const universityId = positiveInteger(study?.institutionId);
    const specialtyId = positiveInteger(study?.specialtyId);
    const [university, specialty] = await Promise.all([
      universityId
        ? this.db.university.findUnique({ where: { id: universityId }, select: { name: true } })
        : Promise.resolve(null),
      specialtyId
        ? this.db.specialty.findUnique({ where: { id: specialtyId }, select: { name: true } })
        : Promise.resolve(null),
    ]);

    const otherInstitution = typeof study?.otherInstitution === "string" ? study.otherInstitution.trim() : "";
    const declaredSpecialty = typeof study?.specialty === "string" ? study.specialty.trim() : "";
    const cycle = Number(study?.cycle);

    return {
      id: application.id,
      affiliateType: application.affiliateType,
      status: application.status,
      applicant: {
        fullName: personFullName ?? draftFullName,
        universityName: otherInstitution || university?.name || null,
        careerName: declaredSpecialty || specialty?.name || null,
        declaredCycle: Number.isInteger(cycle) && cycle > 0 ? cycle : null,
      },
    };
  }

  /**
   * Crea la fila PROCESSING bajo lock transaccional para evitar análisis
   * simultáneos del mismo archivo/expediente. Una fila PROCESSING vieja se
   * marca como TECHNICAL_ERROR y se permite reintentar.
   */
  public async createProcessingLocked(input: CreateProcessingInput): Promise<string> {
    return this.db.$transaction(async (tx) => {
      const lockKey = `document-prevalidation:${input.applicationId}:${input.fileHash}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

      const staleBefore = new Date(Date.now() - input.staleMs);
      const active = await tx.documentPrevalidation.findFirst({
        where: {
          applicationId: input.applicationId,
          fileHash: input.fileHash,
          status: "PROCESSING",
          createdAt: { gte: staleBefore },
        },
        select: { id: true },
      });
      if (active) throw new PrevalidationInProgressError();

      await tx.documentPrevalidation.updateMany({
        where: {
          applicationId: input.applicationId,
          fileHash: input.fileHash,
          status: "PROCESSING",
          createdAt: { lt: staleBefore },
        },
        data: {
          status: "TECHNICAL_ERROR",
          errorCode: "STALE_PROCESSING",
          analyzedAt: new Date(),
        },
      });

      const created = await tx.documentPrevalidation.create({
        data: {
          applicationId: input.applicationId,
          fileUrl: input.fileUrl,
          fileName: input.fileName,
          mimeType: input.mimeType,
          sizeBytes: BigInt(input.sizeBytes),
          fileHash: input.fileHash,
          status: "PROCESSING",
          extractionSchemaVersion: input.extractionSchemaVersion,
          promptVersion: input.promptVersion,
          rulesVersion: input.rulesVersion,
        },
        select: { id: true },
      });
      return created.id;
    });
  }

  public async findReusableExtraction(query: ReusableExtractionQuery): Promise<ReusableExtractionResult | null> {
    const cutoff = new Date(Date.now() - query.maxAgeMs);
    const row = await this.db.documentPrevalidation.findFirst({
      where: {
        applicationId: query.applicationId,
        fileHash: query.fileHash,
        status: "COMPLETED",
        modelUsed: query.model,
        extractionSchemaVersion: query.extractionSchemaVersion,
        promptVersion: query.promptVersion,
        analyzedAt: { gte: cutoff },
        extraction: { not: Prisma.DbNull },
      },
      orderBy: { createdAt: "desc" },
      select: { extraction: true, fileUrl: true },
    });
    if (!row) return null;
    const parsed = documentExtractionSchema.safeParse(row.extraction);
    return parsed.success ? { extraction: parsed.data, fileUrl: row.fileUrl } : null;
  }

  public async completeAnalysis(id: string, input: CompleteAnalysisInput): Promise<void> {
    await this.db.documentPrevalidation.update({
      where: { id },
      data: {
        status: "COMPLETED",
        result: input.result,
        extraction: input.extraction as unknown as Prisma.InputJsonValue,
        applicantContext: input.applicantContext as unknown as Prisma.InputJsonValue,
        rules: input.rules as unknown as Prisma.InputJsonValue,
        warnings: input.warnings as unknown as Prisma.InputJsonValue,
        modelUsed: input.modelUsed,
        modelVersion: input.modelVersion,
        tokenUsage: input.tokenUsage
          ? input.tokenUsage as unknown as Prisma.InputJsonValue
          : Prisma.DbNull,
        attempts: input.attempts,
        extractionSchemaVersion: input.extractionSchemaVersion,
        promptVersion: input.promptVersion,
        rulesVersion: input.rulesVersion,
        durationMs: input.durationMs,
        extractionMs: input.extractionMs,
        rulesMs: input.rulesMs,
        cacheHit: input.cacheHit,
        errorCode: null,
        analyzedAt: new Date(),
      },
    });
  }

  public async markTechnicalError(id: string, errorCode: string, durationMs: number): Promise<void> {
    await this.db.documentPrevalidation.update({
      where: { id },
      data: {
        status: "TECHNICAL_ERROR",
        errorCode,
        durationMs,
        analyzedAt: new Date(),
      },
    });
  }
}
