import { createHash } from "crypto";
import type { DocumentAiConfig } from "@/lib/config/env";
import { S3StorageService } from "@/modules/shared/Services/S3StorageService";
import type { DocumentExtraction } from "../Models/DocumentExtraction";
import type {
  DocumentPrevalidationResponse,
  PrevalidationResultStatus,
} from "../Models/DocumentPrevalidationDTO";
import {
  DOCUMENT_EXTRACTION_SCHEMA_VERSION,
  DOCUMENT_PROMPT_VERSION,
} from "../Prompts/AcademicDocumentPrompt";
import {
  DocumentPrevalidationRepository,
  PrevalidationInProgressError,
  type CompleteAnalysisInput,
  type CreateProcessingInput,
  type DocumentApplicationContext,
  type ReusableExtractionQuery,
  type ReusableExtractionResult,
} from "../Repositories/DocumentPrevalidationRepository";
import {
  AcademicDocumentFileError,
  validateAcademicDocumentFile,
} from "../Validators/AcademicDocumentFileValidator";
import {
  evaluateAcademicDocument,
  ACADEMIC_DOCUMENT_RULES_VERSION,
} from "./AcademicDocumentRules";
import {
  resolveCurrentAcademicPeriod,
  type AcademicValidityPolicy,
} from "./AcademicCalendarPolicy";
import {
  DocumentExtractionError,
  GeminiDocumentAIExtractor,
  type AcademicDocumentExtractor,
  type ExtractionMeta,
} from "./DocumentAIExtractor";

export type DocumentPrevalidationErrorCode =
  | "APPLICATION_NOT_FOUND"
  | "NOT_STUDENT"
  | "APPLICATION_NOT_EDITABLE"
  | "PREVALIDATION_IN_PROGRESS"
  | "STORAGE_ERROR";

export class DocumentPrevalidationServiceError extends Error {
  public constructor(
    public readonly code: DocumentPrevalidationErrorCode,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "DocumentPrevalidationServiceError";
  }
}

export interface PrevalidateDocumentInput {
  readonly applicationId: number;
  readonly buffer: Buffer;
  readonly fileName: string;
  readonly mimeType: string;
}

export interface DocumentPrevalidationRepositoryPort {
  findApplicationContext(applicationId: number): Promise<DocumentApplicationContext | null>;
  createProcessingLocked(input: CreateProcessingInput): Promise<string>;
  findReusableExtraction(query: ReusableExtractionQuery): Promise<ReusableExtractionResult | null>;
  completeAnalysis(id: string, input: CompleteAnalysisInput): Promise<void>;
  markTechnicalError(id: string, errorCode: string, durationMs: number): Promise<void>;
}

interface ServiceDependencies {
  readonly repository?: DocumentPrevalidationRepositoryPort;
  readonly storage?: Pick<S3StorageService, "uploadFile">;
  readonly extractor?: AcademicDocumentExtractor;
  readonly now?: () => Date;
}

const TECHNICAL_ERROR_MESSAGE = "No fue posible completar la revisión automática en este momento. Puedes continuar con la revisión administrativa de tu documento.";
const MAX_WARNINGS = 20;

function technicalResponse(input: {
  file: DocumentPrevalidationResponse["file"];
  durationMs: number;
}): DocumentPrevalidationResponse {
  return {
    status: "TECHNICAL_ERROR",
    message: TECHNICAL_ERROR_MESSAGE,
    result: null,
    rules: [],
    warnings: [],
    extraction: null,
    file: input.file,
    analyzedAt: null,
    durationMs: input.durationMs,
    cacheHit: false,
  };
}

function extractionSummary(extraction: DocumentExtraction): DocumentPrevalidationResponse["extraction"] {
  return {
    tipoDocumento: extraction.tipo_documento,
    universidad: extraction.universidad,
    carrera: extraction.carrera,
    cicloAcademico: extraction.ciclo_academico,
    periodoAcademico: extraction.periodo_academico,
  };
}

function resultMessage(result: PrevalidationResultStatus, rules: DocumentPrevalidationResponse["rules"]): string {
  if (result === "PREVALIDATED") {
    return "Tu constancia cumple con los requisitos documentales verificados automáticamente. El Área de Asociados continuará con la evaluación de tu solicitud.";
  }
  if (result === "NEEDS_REVIEW") {
    return "No hemos podido verificar todos los datos de tu constancia. Tu documento podrá ser revisado por el Área de Asociados.";
  }
  const failed = rules.filter((item) => item.status === "FAIL");
  const typeFailure = failed.find((item) => item.code === "R01");
  if (typeFailure) {
    return `${typeFailure.message} Para continuar, adjunta una constancia de estudios vigente emitida por tu universidad.`;
  }
  const validityFailure = failed.find((item) => item.code === "R06");
  if (validityFailure) {
    return `${validityFailure.message} Para continuar, adjunta una constancia de estudios vigente que indique tu nombre completo, carrera profesional y ciclo académico actual, emitida y firmada por tu universidad.`;
  }
  return `${failed.map((item) => item.message).join(" ")} Puedes reemplazar el documento antes de continuar.`;
}

/**
 * Orquesta validación técnica del archivo, caché por hash, extracción con IA,
 * reglas deterministas y persistencia de trazabilidad. No aprueba afiliaciones
 * ni emite decisiones administrativas.
 */
export class DocumentPrevalidationService {
  private readonly repository: DocumentPrevalidationRepositoryPort;
  private readonly storage: Pick<S3StorageService, "uploadFile">;
  private readonly extractor: AcademicDocumentExtractor;
  private readonly now: () => Date;

  public constructor(
    private readonly config: DocumentAiConfig,
    dependencies: ServiceDependencies = {},
  ) {
    this.repository = dependencies.repository ?? new DocumentPrevalidationRepository();
    this.storage = dependencies.storage ?? new S3StorageService();
    this.extractor = dependencies.extractor ?? new GeminiDocumentAIExtractor(config);
    this.now = dependencies.now ?? (() => new Date());
  }

  public async execute(input: PrevalidateDocumentInput): Promise<DocumentPrevalidationResponse> {
    const startedAt = Date.now();
    const context = await this.repository.findApplicationContext(input.applicationId);
    if (!context) {
      throw new DocumentPrevalidationServiceError("APPLICATION_NOT_FOUND", "La solicitud no está disponible.", 404);
    }
    if (context.affiliateType !== "STUDENT") {
      throw new DocumentPrevalidationServiceError("NOT_STUDENT", "La prevalidación solo aplica a Asociado Estudiante.", 409);
    }
    if (context.status !== "DRAFT" && context.status !== "OBSERVED") {
      throw new DocumentPrevalidationServiceError("APPLICATION_NOT_EDITABLE", "La solicitud ya no admite cambios documentales.", 409);
    }

    await validateAcademicDocumentFile(input.buffer, input.mimeType, {
      maxBytes: this.config.maxFileBytes,
      maxPages: this.config.maxPages,
      maxImageDimension: this.config.maxImageDimension,
    });

    const fileHash = createHash("sha256").update(input.buffer).digest("hex");
    const fileName = input.fileName.slice(0, 250) || "constancia.pdf";
    let extraction: DocumentExtraction | null = null;
    let cachedFileUrl: string | null = null;
    let cacheHit = false;

    // La caché se consulta antes de subir el archivo: si el mismo contenido ya
    // fue extraído con el mismo modelo/esquema/prompt, se reutiliza tanto la
    // extracción como la referencia de S3 y no se vuelve a llamar a Gemini.
    try {
      const reusable = await this.repository.findReusableExtraction({
        applicationId: input.applicationId,
        fileHash,
        model: this.config.model,
        extractionSchemaVersion: DOCUMENT_EXTRACTION_SCHEMA_VERSION,
        promptVersion: DOCUMENT_PROMPT_VERSION,
        maxAgeMs: this.config.cacheTtlMs,
      });
      if (reusable) {
        extraction = reusable.extraction;
        cachedFileUrl = reusable.fileUrl;
        cacheHit = true;
      }
    } catch {
      console.error("[DocumentPrevalidation] No se pudo consultar la caché de extracción:", {
        applicationId: input.applicationId,
      });
    }

    let fileUrl: string;
    if (cachedFileUrl) {
      fileUrl = cachedFileUrl;
    } else {
      try {
        fileUrl = await this.storage.uploadFile(
          input.buffer,
          fileName,
          input.mimeType,
          `afiliaciones/applications/${input.applicationId}/education-documents`,
        );
      } catch {
        throw new DocumentPrevalidationServiceError("STORAGE_ERROR", "No se pudo almacenar el documento.", 502);
      }
    }

    const sizeBytes = input.buffer.length;
    const file = {
      url: fileUrl,
      name: fileName,
      type: input.mimeType,
      sizeBytes,
    };
    const staleMs = Math.max(this.config.timeoutMs * 2, 120_000);

    let rowId: string | null = null;
    try {
      rowId = await this.repository.createProcessingLocked({
        applicationId: input.applicationId,
        fileUrl,
        fileName,
        mimeType: input.mimeType,
        sizeBytes,
        fileHash,
        extractionSchemaVersion: DOCUMENT_EXTRACTION_SCHEMA_VERSION,
        promptVersion: DOCUMENT_PROMPT_VERSION,
        rulesVersion: ACADEMIC_DOCUMENT_RULES_VERSION,
        staleMs,
      });
    } catch (error) {
      if (error instanceof PrevalidationInProgressError) {
        throw new DocumentPrevalidationServiceError(
          "PREVALIDATION_IN_PROGRESS",
          "Ya estamos revisando este documento. Espera unos segundos antes de reintentar.",
          409,
        );
      }
      console.error("[DocumentPrevalidation] No se pudo registrar el inicio del análisis:", {
        applicationId: input.applicationId,
      });
    }

    const extractionStartedAt = Date.now();
    let extractionMeta: ExtractionMeta | null = null;

    if (!extraction) {
      try {
        const result = await this.extractor.extract({ buffer: input.buffer, mimeType: input.mimeType });
        extraction = result.extraction;
        extractionMeta = result.meta;
      } catch (error) {
        const code = error instanceof DocumentExtractionError ? error.code : "NETWORK";
        const durationMs = Date.now() - startedAt;
        if (rowId) {
          try {
            await this.repository.markTechnicalError(rowId, code, durationMs);
          } catch {
            console.error("[DocumentPrevalidation] No se pudo registrar el error técnico:", { code });
          }
        }
        console.error("[DocumentPrevalidation] Extracción no completada:", { code });
        return technicalResponse({ file, durationMs });
      }
    }
    const extractionMs = cacheHit ? 0 : Date.now() - extractionStartedAt;

    const referenceDate = this.now();
    const currentPeriod = resolveCurrentAcademicPeriod(referenceDate, this.config.currentAcademicPeriod);
    if (!currentPeriod) {
      if (rowId) {
        try {
          await this.repository.markTechnicalError(rowId, "CONFIGURATION", Date.now() - startedAt);
        } catch {
          console.error("[DocumentPrevalidation] No se pudo registrar el error de configuración.");
        }
      }
      return technicalResponse({ file, durationMs: Date.now() - startedAt });
    }
    const validityPolicy: AcademicValidityPolicy = {
      currentPeriod,
      maxPreviousSemesters: this.config.maxAcademicAgeSemesters,
    };

    const rulesStartedAt = Date.now();
    const evaluation = evaluateAcademicDocument({
      extraction,
      applicant: context.applicant,
      validityPolicy,
    });
    const rulesMs = Date.now() - rulesStartedAt;
    const durationMs = Date.now() - startedAt;

    if (rowId) {
      try {
        await this.repository.completeAnalysis(rowId, {
          result: evaluation.result,
          extraction,
          applicantContext: context.applicant,
          rules: evaluation.rules,
          warnings: evaluation.warnings.slice(0, MAX_WARNINGS),
          modelUsed: extractionMeta?.model ?? this.config.model,
          modelVersion: extractionMeta?.modelVersion ?? null,
          tokenUsage: extractionMeta ? { ...extractionMeta.usage } : null,
          attempts: extractionMeta?.attempts ?? null,
          extractionSchemaVersion: extractionMeta?.schemaVersion ?? DOCUMENT_EXTRACTION_SCHEMA_VERSION,
          promptVersion: extractionMeta?.promptVersion ?? DOCUMENT_PROMPT_VERSION,
          rulesVersion: ACADEMIC_DOCUMENT_RULES_VERSION,
          durationMs,
          extractionMs,
          rulesMs,
          cacheHit,
        });
      } catch {
        console.error("[DocumentPrevalidation] El análisis no pudo persistirse:", {
          applicationId: input.applicationId,
          result: evaluation.result,
        });
      }
    }

    return {
      status: evaluation.result,
      message: resultMessage(evaluation.result, evaluation.rules),
      result: evaluation.result,
      rules: evaluation.rules,
      warnings: evaluation.warnings.slice(0, MAX_WARNINGS),
      extraction: extractionSummary(extraction),
      file,
      analyzedAt: this.now().toISOString(),
      durationMs,
      cacheHit,
    };
  }
}

export { AcademicDocumentFileError };
