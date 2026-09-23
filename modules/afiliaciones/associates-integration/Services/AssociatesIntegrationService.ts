import { AssociateIntegrationAttemptResult, type AssociateIntegrationTrigger } from "@prisma/client";
import type {
  AssociateIntegrationRecord,
  AssociateIntegrationAttemptOutcome,
  AssociateRequestPayloadSnapshot,
} from "../Models/AssociateIntegration";
import { AssociateIntegrationRepository } from "../Repositories/AssociateIntegrationRepository";
import type {
  AssociateIntegrationError,
  AssociateIntegrationTransaction,
  IAssociateIntegrationRepository,
} from "../Repositories/Interfaces/IAssociateIntegrationRepository";
import { AssociatesApiClient } from "../Clients/AssociatesApiClient";
import { AssociatesApiError } from "../Clients/AssociatesApiError";
import { AssociatesPayloadMapper } from "../Mappers/AssociatesPayloadMapper";
import {
  AssociateIntegrationSnapshotBuilder,
  AssociateSnapshotBuildError,
  type AssociateSnapshotSource,
} from "./AssociateIntegrationSnapshotBuilder";
import type { ActivePaymentIntegrationSource } from "../../payments/Repositories/Interfaces/IPaymentRepository";

/** Durable integration outbox. External transport intentionally starts in Phase B. */
export class AssociatesIntegrationService {
  constructor(
    private readonly repository: IAssociateIntegrationRepository = new AssociateIntegrationRepository(),
    private readonly mapper = new AssociatesPayloadMapper(),
    private client?: Pick<AssociatesApiClient, "createAssociate">,
  ) {}

  prepare(
    input: {
      applicationId: number;
      trigger: AssociateIntegrationTrigger;
      requestPayloadSnapshot: AssociateRequestPayloadSnapshot;
    },
    tx?: AssociateIntegrationTransaction,
  ): Promise<AssociateIntegrationRecord> {
    return this.repository.createPendingIfAbsent(input, tx);
  }

  prepareFailed(
    input: {
      applicationId: number;
      trigger: AssociateIntegrationTrigger;
      requestPayloadSnapshot: AssociateRequestPayloadSnapshot;
      error: AssociateIntegrationError;
    },
    tx?: AssociateIntegrationTransaction,
  ): Promise<AssociateIntegrationRecord> {
    return this.repository.createFailedIfAbsent(input, tx);
  }

  async prepareActivePayment(
    source: ActivePaymentIntegrationSource,
    tx: AssociateIntegrationTransaction,
  ): Promise<AssociateIntegrationRecord | null> {
    if (source.payment.status !== "PAID") return null;

    const builder = new AssociateIntegrationSnapshotBuilder();

    try {
      if (
        source.payment.registrationAmount === null ||
        source.payment.membershipFeeAmount === null
      ) {
        throw new AssociateSnapshotBuildError(
          "MISSING_PAYMENT_BREAKDOWN",
          "El pago aprobado no tiene desglose de inscripción y cuota.",
        );
      }

      if (!source.payment.paymentDate) {
        throw new AssociateSnapshotBuildError(
          "MISSING_PAYMENT_DATE",
          "El pago aprobado no tiene fecha efectiva persistida.",
        );
      }

      if (source.payment.currency !== "PEN") {
        throw new AssociateSnapshotBuildError(
          "UNSUPPORTED_PAYMENT_CURRENCY",
          "La integración V1 solo admite pagos persistidos en PEN.",
        );
      }

      return await this.prepare(
        {
          applicationId: source.applicationId,
          trigger: "ACTIVE_PAYMENT",
          requestPayloadSnapshot: builder.activeFrom(
            source,
            source.payment.paymentDate,
            {
              registration: source.payment.registrationAmount,
              monthlyFee: source.payment.membershipFeeAmount,
              total: source.payment.totalAmount,
            },
          ),
        },
        tx,
      );
    } catch (error) {
      const buildError =
        error instanceof AssociateSnapshotBuildError
          ? error
          : new AssociateSnapshotBuildError(
              "INVALID_ACTIVE_SNAPSHOT",
              error instanceof Error
                ? error.message
                : "No se pudo construir el snapshot activo.",
            );

      return this.prepareFailed(
        {
          applicationId: source.applicationId,
          trigger: "ACTIVE_PAYMENT",
          requestPayloadSnapshot: builder.failedSnapshot(source, "A"),
          error: {
            code: buildError.code,
            message: buildError.message,
          },
        },
        tx,
      );
    }
  }

  async prepareStudentCompletion(
    input: {
      applicationId: number;
      source: AssociateSnapshotSource;
      effectiveAt: Date;
    },
    tx: AssociateIntegrationTransaction,
  ): Promise<AssociateIntegrationRecord> {
    const builder = new AssociateIntegrationSnapshotBuilder();

    try {
      return await this.prepare(
        {
          applicationId: input.applicationId,
          trigger: "STUDENT_COMPLETION",
          requestPayloadSnapshot: builder.studentFrom(
            input.source,
            input.effectiveAt,
          ),
        },
        tx,
      );
    } catch (error) {
      const buildError =
        error instanceof AssociateSnapshotBuildError
          ? error
          : new AssociateSnapshotBuildError(
              "INVALID_STUDENT_SNAPSHOT",
              error instanceof Error
                ? error.message
                : "No se pudo construir el snapshot estudiante.",
            );

      return this.prepareFailed(
        {
          applicationId: input.applicationId,
          trigger: "STUDENT_COMPLETION",
          requestPayloadSnapshot: builder.failedSnapshot(input.source, "E"),
          error: {
            code: buildError.code,
            message: buildError.message,
          },
        },
        tx,
      );
    }
  }

  async processAfterCommit(integrationId: number): Promise<void> {
    try {
      await this.processIntegration(integrationId);
    } catch (error) {
      console.warn("Associate integration post-commit processing failed", {
        integrationId,
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  findByApplicationId(
    applicationId: number,
    tx?: AssociateIntegrationTransaction,
  ) {
    return this.repository.findByApplicationId(applicationId, tx);
  }

  markProcessing(
    applicationId: number,
    tx?: AssociateIntegrationTransaction,
  ) {
    return this.repository.markProcessing(applicationId, tx);
  }

  markSynced(
    applicationId: number,
    result: {
      externalAssociateCode: number;
      externalMessage?: string;
      receipt?: {
        type?: string;
        serie?: string;
        number?: string;
        pdfReference?: string;
      };
    },
    tx?: AssociateIntegrationTransaction,
  ) {
    return this.repository.markSynced(applicationId, result, tx);
  }

  markRetryable(
    applicationId: number,
    error: AssociateIntegrationError,
    tx?: AssociateIntegrationTransaction,
  ) {
    return this.repository.markRetryable(applicationId, error, tx);
  }

  markFailed(
    applicationId: number,
    error: AssociateIntegrationError,
    tx?: AssociateIntegrationTransaction,
  ) {
    return this.repository.markFailed(applicationId, error, tx);
  }

  async listAdmin(params: Parameters<IAssociateIntegrationRepository["listAdmin"]>[0]) {
    const result = await this.repository.listAdmin(params);
    return { total: result.total, data: result.data.map((item: any) => this.toAdminListItem(item)) };
  }

  async detailAdmin(id: number) {
    const item = await this.repository.findAdminById(id);
    if (!item) return null;

    const snapshot = item.requestPayloadSnapshot as AssociateRequestPayloadSnapshot;
    const person = item.application.person;
    const billing = item.application.payments?.[0]?.billing ?? null;
    const fullName = person ? formatFullName(person) : formatSnapshotName(snapshot);
    const documentNumber = person?.documentNumber ?? snapshot.NumDocumento;
    const documentType = person?.documentType ?? null;
    const attemptHistory = item.attemptHistory ?? [];
    return {
      integrationId: item.id,
      applicationId: item.applicationId,
      applicationCode: item.application.applicationCode,
      trackingCode: item.application.trackingCode,
      affiliateType: item.application.affiliateType,
      trigger: item.trigger,
      status: item.status,
      attempts: item.attempts,
      lastAttemptAt: item.lastAttemptAt,
      syncedAt: item.syncedAt,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      associate: { fullName, documentType, maskedDocumentNumber: maskDocument(documentNumber), addressAvailable: Boolean(person?.addresses?.length) },
      billing: toSafeBilling(billing),
      services: snapshot.servicios.map((service) => ({ concepto: service.concepto, anno: service.anno, moneda: service.moneda, monto: service.monto, cortesia: service.cortesia })),
      result: {
        externalAssociateCode: item.externalAssociateCode,
        externalMessage: sanitizeText(item.externalMessage),
        receiptType: item.externalReceiptType,
        serie: item.externalReceiptSerie,
        numero: item.externalReceiptNumber,
        pdfReference: item.externalReceiptPdfReference,
      },
      error: {
        httpStatus: item.lastErrorHttpStatus,
        code: sanitizeText(item.lastErrorCode, 100),
        message: sanitizeText(item.lastErrorMessage),
        identifier: sanitizeText(item.lastErrorIdentifier, 255),
      },
      attemptHistory: [...attemptHistory].sort((left: any, right: any) => right.attemptNumber - left.attemptNumber || right.startedAt.getTime() - left.startedAt.getTime()).map((attempt: any) => ({
        attemptNumber: attempt.attemptNumber,
        startedAt: attempt.startedAt,
        finishedAt: attempt.finishedAt,
        result: attempt.result,
        httpStatus: attempt.httpStatus,
        errorCode: sanitizeText(attempt.errorCode, 100),
        message: sanitizeText(attempt.message),
        errorIdentifier: sanitizeText(attempt.errorIdentifier, 255),
        externalAssociateCode: attempt.externalAssociateCode,
        externalMessage: sanitizeText(attempt.externalMessage),
        durationMs: attempt.durationMs,
      })),
      sanitizedPayloadPreview: toSanitizedPayloadPreview(snapshot),
    };
  }

  async retryManual(id: number, userId: number) {
    const item = await this.repository.findById(id);

    if (!item) {
      throw Object.assign(new Error("Integración no encontrada."), {
        status: 404,
      });
    }

    if (item.status !== "RETRYABLE") {
      throw Object.assign(
        new Error(
          item.status === "PROCESSING"
            ? "La integración ya está siendo procesada."
            : "Solo se puede reintentar una integración RETRYABLE.",
        ),
        { status: 409 },
      );
    }

    // Claim atómico: solo un proceso puede mover RETRYABLE -> PROCESSING.
    const claimed = await this.repository.markProcessing(item.applicationId);

    if (!claimed) {
      throw Object.assign(new Error("La integración ya está siendo procesada."), {
        status: 409,
      });
    }

    // La integración ya está reclamada. No debe volver a ejecutar markProcessing().
    const result = await this.processClaimedIntegration(claimed);

    await this.repository.createRetryAudit({
      userId,
      integrationId: id,
      result: result?.status ?? "UNKNOWN",
    });

    return result;
  }

  private toAdminListItem(item: any) {
    const person = item.application.person;
    const billing = item.application.payments?.[0]?.billing ?? null;
    return {
      integrationId: item.id,
      applicationId: item.applicationId,
      applicationCode: item.application.applicationCode,
      trackingCode: item.application.trackingCode,
      affiliateType: item.application.affiliateType,
      trigger: item.trigger,
      status: item.status,
      attempts: item.attempts,
      externalAssociateCode: item.externalAssociateCode,
      lastAttemptAt: item.lastAttemptAt,
      createdAt: item.createdAt,
      associate: person ? { fullName: formatFullName(person), documentType: person.documentType, maskedDocumentNumber: maskDocument(person.documentNumber) } : null,
      billing: toSafeBilling(billing),
    };
  }

  /**
   * Procesamiento normal (post-commit / ejecución interna).
   * Reclama la integración una sola vez antes de enviar al API externo.
   */
  async processIntegration(
    integrationId: number,
  ): Promise<AssociateIntegrationRecord | null> {
    const integration = await this.repository.findById(integrationId);
    if (!integration) return null;

    const claimed = await this.repository.markProcessing(
      integration.applicationId,
    );

    if (!claimed) {
      return this.repository.findByApplicationId(integration.applicationId);
    }

    return this.processClaimedIntegration(claimed);
  }

  /**
   * Procesa una integración que YA fue reclamada y está en PROCESSING.
   * Este método nunca vuelve a ejecutar markProcessing().
   */
  private async processClaimedIntegration(
    claimed: AssociateIntegrationRecord,
  ): Promise<AssociateIntegrationRecord | null> {
    let payload;
    try {
      payload = this.mapper.map(claimed.requestPayloadSnapshot);
    } catch (error) {
      const mapped = sanitizePersistedError(toPersistedError(error));
      return mapped.retryable
        ? this.repository.markRetryable(claimed.applicationId, mapped)
        : this.repository.markFailed(claimed.applicationId, mapped);
    }

    const startedAt = new Date();
    let attempt;
    try {
      attempt = await this.repository.startAttempt(claimed.id, startedAt);
    } catch (error) {
      return this.repository.markRetryable(claimed.applicationId, {
        code: "OBSERVABILITY_START_FAILED",
        message: "No se pudo iniciar el registro de observabilidad del envío.",
      });
    }

    let outcome: AssociateIntegrationAttemptOutcome;
    let integration: AssociateIntegrationRecord | null = null;
    console.info("SIE_ASSOCIATE_SEND", {
      phase: "started",
      operation: "SIE_ASSOCIATE_SEND",
      integrationId: claimed.id,
      applicationId: claimed.applicationId,
      attemptNumber: attempt.attemptNumber,
    });
    try {
      const result = await (this.client ??= new AssociatesApiClient()).createAssociate(payload);
      outcome = {
        result: AssociateIntegrationAttemptResult.SYNCED,
        httpStatus: result.httpStatus,
        externalAssociateCode: result.externalAssociateCode,
        externalMessage: sanitizeText(result.externalMessage),
        durationMs: Date.now() - startedAt.getTime(),
      };
      integration = await this.repository.markSynced(claimed.applicationId, result);
    } catch (error) {
      const mapped = sanitizePersistedError(toPersistedError(error));
      outcome = {
        result: mapped.retryable ? AssociateIntegrationAttemptResult.RETRYABLE : AssociateIntegrationAttemptResult.FAILED,
        httpStatus: mapped.httpStatus,
        errorCode: sanitizeText(mapped.code, 100),
        message: sanitizeText(mapped.message),
        errorIdentifier: sanitizeText(mapped.identifier, 255),
        errorDetails: sanitizeDetails(mapped.details),
        durationMs: Date.now() - startedAt.getTime(),
      };
      integration = mapped.retryable
        ? await this.repository.markRetryable(claimed.applicationId, mapped)
        : await this.repository.markFailed(claimed.applicationId, mapped);
    }

    try {
      await this.repository.finishAttempt(attempt.id, outcome, new Date());
    } catch (error) {
      console.warn("Associate integration attempt observability completion failed", {
        integrationId: claimed.id,
        attemptId: attempt.id,
        error: error instanceof Error ? error.message : "unknown",
      });
    }
    console.info("SIE_ASSOCIATE_SEND", {
      phase: "finished",
      operation: "SIE_ASSOCIATE_SEND",
      integrationId: claimed.id,
      applicationId: claimed.applicationId,
      attemptNumber: attempt.attemptNumber,
      result: outcome.result,
      httpStatus: outcome.httpStatus ?? null,
      externalAssociateCode: outcome.externalAssociateCode ?? null,
      durationMs: outcome.durationMs,
      errorCode: outcome.errorCode ?? null,
    });
    return integration;
  }
}

function formatFullName(person: { firstName: string; paternalLastName: string; maternalLastName?: string | null }) {
  return [person.firstName, person.paternalLastName, person.maternalLastName].filter(Boolean).join(" ");
}

function formatSnapshotName(snapshot: AssociateRequestPayloadSnapshot) {
  return [snapshot.Nombres, snapshot.ApellidoPaterno, snapshot.ApellidoMaterno].filter(Boolean).join(" ") || "No disponible";
}

function maskDocument(value?: string | null) {
  if (!value) return "—";
  if (value.length <= 4) return "••••";
  return `${value.slice(0, 2)}***${value.slice(-2)}`;
}

function toSafeBilling(billing: { receiptType?: string | null; documentType?: string | null; taxId?: string | null; businessName?: string | null; billingAddress?: string | null } | null) {
  if (!billing) return { receiptType: null, billingDocumentType: null, maskedBillingDocument: "—", businessName: null, billingAddressAvailable: false };
  return { receiptType: billing.receiptType ?? null, billingDocumentType: billing.documentType ?? null, maskedBillingDocument: maskDocument(billing.taxId), businessName: billing.receiptType === "FACTURA" ? billing.businessName ?? null : null, billingAddressAvailable: Boolean(billing.billingAddress?.trim()) };
}

function toSanitizedPayloadPreview(snapshot: AssociateRequestPayloadSnapshot) {
  return { TipoDocumento: snapshot.TipoDocumento, NumDocumento: maskDocument(snapshot.NumDocumento), Nombres: snapshot.Nombres, ApellidoPaterno: snapshot.ApellidoPaterno, ApellidoMaterno: snapshot.ApellidoMaterno, Tipo: snapshot.Tipo, TipoFacturacion: snapshot.TipoFacturacion, TipDocFacturacion: snapshot.TipDocFacturacion, NumDocFacturacion: maskDocument(snapshot.NumDocFacturacion), RazonSocial: snapshot.RazonSocial ?? null, Email: maskEmail(snapshot.Email), Telefono: maskPhone(snapshot.Telefono), servicios: snapshot.servicios.map((service) => ({ concepto: service.concepto, anno: service.anno, moneda: service.moneda, monto: service.monto, cortesia: service.cortesia })) };
}

function maskEmail(value?: string | null) { if (!value || !value.includes("@")) return "—"; const [local, domain] = value.split("@"); return `${local.slice(0, 2)}***@${domain}`; }
function maskPhone(value?: string | null) { if (!value) return "—"; return value.length > 4 ? `${value.slice(0, 2)}***${value.slice(-2)}` : "••••"; }

function sanitizeText(value: unknown, maxLength = 1_000): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  return value.trim().replace(/Bearer\s+\S+/gi, "[REDACTED]").replace(/(?:password|clave|token)\s*[:=]\s*\S+/gi, "[REDACTED]").replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[REDACTED_EMAIL]").replace(/\b\d{7,}\b/g, "[REDACTED_NUMBER]").slice(0, maxLength);
}

function sanitizeDetails(details: unknown): string[] | undefined {
  if (!Array.isArray(details)) return undefined;
  const sanitized = details.map((detail) => sanitizeText(detail, 500)).filter((detail): detail is string => Boolean(detail)).slice(0, 10);
  return sanitized.length ? sanitized : undefined;
}

function sanitizePersistedError(error: AssociateIntegrationError & { retryable: boolean }): AssociateIntegrationError & { retryable: boolean } {
  return {
    ...error,
    code: sanitizeText(error.code, 100),
    message: sanitizeText(error.message),
    identifier: sanitizeText(error.identifier, 255),
    details: sanitizeDetails(error.details),
  };
}

function toPersistedError(
  error: unknown,
): AssociateIntegrationError & { retryable: boolean } {
  if (error instanceof AssociatesApiError) {
    return {
      httpStatus: error.httpStatus,
      code: error.code,
      message: error.message,
      identifier: error.identifier,
      details: error.details,
      retryable: error.retryable,
    };
  }

  return {
    code: "SNAPSHOT_INVALID",
    message:
      error instanceof Error
        ? error.message
        : "No se pudo procesar la integración.",
    retryable: false,
  };
}
