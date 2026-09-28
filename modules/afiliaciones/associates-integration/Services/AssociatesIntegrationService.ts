import { AssociateIntegrationAttemptResult, AssociateIntegrationStatus, AssociateIntegrationTrigger } from "@prisma/client";
import type {
  AssociateIntegrationRecord,
  AssociateIntegrationAttemptOutcome,
  AssociateRequestPayloadSnapshot,
  SieAssociateState,
  SieAssociateStateQuota,
} from "../Models/AssociateIntegration";
import { AssociateIntegrationRepository } from "../Repositories/AssociateIntegrationRepository";
import type {
  AssociateIntegrationError,
  AssociateIntegrationTransaction,
  IAssociateIntegrationRepository,
} from "../Repositories/Interfaces/IAssociateIntegrationRepository";
import { AssociatesApiClient } from "../Clients/AssociatesApiClient";
import { AssociatesApiError } from "../Clients/AssociatesApiError";
import { AssociatesApiConfigurationError } from "../Config/AssociatesApiConfig";
import { AssociatesPayloadMapper, AssociatesPayloadValidationError, toSieDocumentType } from "../Mappers/AssociatesPayloadMapper";
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
    private client?: Pick<AssociatesApiClient, "createAssociate" | "getAssociateState">,
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

    // A manual retry first reconciles the exact frozen payload. It may send a
    // new POST only when SIE proves that operation is absent.
    const reconciliation = await this.reconcileBeforeRetry(claimed);
    const result = reconciliation === "ABSENT"
      ? await this.processClaimedIntegration(claimed)
      : await this.repository.findByApplicationId(claimed.applicationId);

    await this.repository.createRetryAudit({
      userId,
      integrationId: id,
      result: result?.status ?? "UNKNOWN",
    });

    return result;
  }

  /**
   * Recovers only a proven pre-dispatch configuration failure. It never sends
   * POST /asociados; a later explicit RETRYABLE action still reconciles first.
   */
  async recoverPreDispatchFailure(id: number, userId: number) {
    const finder = this.repository.findPreDispatchRecoveryCandidate;
    const resolver = this.repository.resolvePreDispatchRecovery;
    if (!finder || !resolver) throw recoveryError("La recuperación pre-despacho no está disponible.", 409);
    const candidate = await finder.call(this.repository, id);
    if (!candidate) throw recoveryError("Integración no encontrada.", 404);
    const { integration, attemptHistoryCount } = candidate;
    const legacy = isLegacyConfigurationFailure(integration);
    if (!isPreDispatchFailure(integration, attemptHistoryCount) || !(integration.lastErrorCode === "ASSOCIATES_API_CONFIGURATION_MISSING" || legacy)) {
      throw recoveryError("La integración no cumple las condiciones para recuperación pre-despacho.", 409);
    }
    let payload: AssociateRequestPayloadSnapshot;
    try { payload = this.mapper.map(integration.requestPayloadSnapshot); }
    catch (error) { throw recoveryError(error instanceof AssociatesPayloadValidationError ? "El snapshot no es válido para recuperación." : "No se pudo validar el snapshot de recuperación.", 409); }
    if (legacy && !(payload.Tipo === "A" && hasEnrollmentServices(payload))) throw recoveryError("El incidente legacy no corresponde a un alta activa verificable.", 409);
    let reconciliation: "ABSENT" | "MATCH";
    try {
      const state = await this.apiClient().getAssociateState(stateRequest(payload));
      if (!state.status) reconciliation = "ABSENT";
      else if (reconcileSnapshot(payload, state) === "MATCH") reconciliation = "MATCH";
      else throw recoveryError("El estado remoto presente no permite recuperar esta integración.", 409);
    }
    catch { throw recoveryError("No se pudo reconciliar el estado remoto; la recuperación fue bloqueada.", 409); }
    const recovered = await resolver.call(this.repository, { integrationId: integration.id, userId, originalErrorCode: integration.lastErrorCode, legacy, reconciliation });
    if (!recovered) throw recoveryError("La integración cambió durante la recuperación.", 409);
    return recovered;
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

    // P0-B applies only to the first ACTIVE dispatch. Student integrations and
    // established RETRYABLE dispatches deliberately retain their prior flow.
    if (
      integration.trigger === AssociateIntegrationTrigger.ACTIVE_PAYMENT &&
      integration.status === AssociateIntegrationStatus.PENDING
    ) {
      return this.processInitialActiveIntegration(integration);
    }

    const claimed = await this.repository.markProcessing(
      integration.applicationId,
    );

    if (!claimed) {
      return this.repository.findByApplicationId(integration.applicationId);
    }

    return this.processClaimedIntegration(claimed);
  }

  private async processInitialActiveIntegration(integration: AssociateIntegrationRecord): Promise<AssociateIntegrationRecord | null> {
    let finalizedSnapshot: AssociateRequestPayloadSnapshot;
    try {
      const state = await this.apiClient().getAssociateState({
        ...stateRequest(integration.requestPayloadSnapshot),
        numDocumento: integration.requestPayloadSnapshot.NumDocumento,
      });
      finalizedSnapshot = this.finalizeActiveSnapshot(integration.requestPayloadSnapshot, state);
    } catch (error) {
      const persisted = sanitizePersistedError(toPersistedError(error));
      // P0-C owns external retry/reconciliation. Until then this must be the
      // existing reviewable terminal state, never a retry that skips GET state.
      return this.repository.markPendingClassificationFailed(integration.applicationId, {
        ...persisted,
        code: persisted.code ?? "SIE_STATE_CLASSIFICATION_FAILED",
      });
    }

    const claimed = await this.repository.claimPendingWithFinalizedPayload(
      integration.applicationId,
      finalizedSnapshot,
    );
    if (!claimed) return this.repository.findByApplicationId(integration.applicationId);
    return this.processClaimedIntegration(claimed);
  }

  private finalizeActiveSnapshot(snapshot: AssociateRequestPayloadSnapshot, state: SieAssociateState): AssociateRequestPayloadSnapshot {
    if (state.status === false) return snapshot;
    const renewal = determineRenewalPeriod(state.cuotas, snapshot);
    return new AssociateIntegrationSnapshotBuilder().renewalFromInitialActiveSnapshot(snapshot, renewal.anno);
  }

  private apiClient(): Pick<AssociatesApiClient, "createAssociate" | "getAssociateState"> {
    return (this.client ??= new AssociatesApiClient());
  }

  private async reconcileBeforeRetry(claimed: AssociateIntegrationRecord): Promise<ReconciliationResult> {
    try {
      const state = await this.apiClient().getAssociateState(stateRequest(claimed.requestPayloadSnapshot));
      const result = reconcileSnapshot(claimed.requestPayloadSnapshot, state);
      if (result === "MATCH") {
        await this.repository.markSyncedByReconciliation(claimed.applicationId);
      } else if (result === "CONFLICT") {
        await this.repository.markFailed(claimed.applicationId, { code: "SIE_RECONCILIATION_CONFLICT", message: "El estado remoto es incompatible con el payload enviado." });
      } else if (result === "AMBIGUOUS") {
        await this.repository.markRetryable(claimed.applicationId, { code: "SIE_RECONCILIATION_AMBIGUOUS", message: "El estado remoto no permite autorizar un nuevo envio." });
      }
      return result;
    } catch (error) {
      const persisted = sanitizePersistedError(toPersistedError(error));
      await this.repository.markRetryable(claimed.applicationId, { ...persisted, code: "SIE_RECONCILIATION_GET_FAILED" });
      return "AMBIGUOUS";
    }
  }

  private async reconcileUncertainPost(claimed: AssociateIntegrationRecord, original: AssociateIntegrationError & { retryable: boolean }): Promise<{ integration: AssociateIntegrationRecord; result: AssociateIntegrationAttemptResult }> {
    try {
      const state = await this.apiClient().getAssociateState(stateRequest(claimed.requestPayloadSnapshot));
      const result = reconcileSnapshot(claimed.requestPayloadSnapshot, state);
      if (result === "MATCH") return { integration: await this.repository.markSyncedByReconciliation(claimed.applicationId), result: AssociateIntegrationAttemptResult.SYNCED };
      if (result === "CONFLICT") return { integration: await this.repository.markFailed(claimed.applicationId, { code: "SIE_RECONCILIATION_CONFLICT", message: "El estado remoto es incompatible con el payload enviado." }), result: AssociateIntegrationAttemptResult.FAILED };
      return { integration: await this.repository.markRetryable(claimed.applicationId, { code: result === "ABSENT" ? "SIE_RECONCILIATION_ABSENT" : "SIE_RECONCILIATION_AMBIGUOUS", message: "No se autorizo un segundo POST automatico tras un resultado incierto de SIE." }), result: AssociateIntegrationAttemptResult.RETRYABLE };
    } catch {
      return { integration: await this.repository.markRetryable(claimed.applicationId, { ...original, code: "SIE_RECONCILIATION_GET_FAILED" }), result: AssociateIntegrationAttemptResult.RETRYABLE };
    }
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
      const result = await this.apiClient().createAssociate(payload);
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
      const uncertain = isUncertainPostOutcome(error);
      if (uncertain) {
        const reconciled = await this.reconcileUncertainPost(claimed, mapped);
        integration = reconciled.integration;
        outcome = { result: reconciled.result, httpStatus: mapped.httpStatus, errorCode: sanitizeText(mapped.code, 100), message: sanitizeText(mapped.message), errorIdentifier: sanitizeText(mapped.identifier, 255), errorDetails: sanitizeDetails(mapped.details), durationMs: Date.now() - startedAt.getTime() };
      } else {
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

class SieStateClassificationError extends Error {
  constructor(readonly code: string, message: string) { super(message); this.name = "SieStateClassificationError"; }
}

type ReconciliationResult = "MATCH" | "ABSENT" | "AMBIGUOUS" | "CONFLICT";

const LEGACY_CONFIGURATION_ERROR_MESSAGE = "La integración de asociados no está configurada. Faltan variables privadas requeridas.";

function stateRequest(snapshot: AssociateRequestPayloadSnapshot) {
  return { tipoDocumento: toSieDocumentType(snapshot.TipoDocumento), numDocumento: snapshot.NumDocumento } as const;
}

function hasEnrollmentServices(snapshot: AssociateRequestPayloadSnapshot) {
  const concepts = new Set(snapshot.servicios.map((service) => service.concepto));
  return snapshot.servicios.length === 2 && concepts.size === 2 && concepts.has("INSCRIPCION") && concepts.has("CUOTA");
}

function isLegacyConfigurationFailure(item: AssociateIntegrationRecord) {
  return item.lastErrorCode === "SNAPSHOT_INVALID" && item.lastErrorMessage === LEGACY_CONFIGURATION_ERROR_MESSAGE;
}

function isPreDispatchFailure(item: AssociateIntegrationRecord, attemptHistoryCount: number) {
  return item.status === AssociateIntegrationStatus.FAILED
    && item.attempts === 0
    && attemptHistoryCount === 0
    && item.lastAttemptAt === null
    && item.lastErrorHttpStatus === null
    && item.lastErrorIdentifier === null
    && item.lastErrorDetails === null
    && item.externalAssociateCode === null
    && item.syncedAt === null;
}

function recoveryError(message: string, status: 404 | 409) {
  return Object.assign(new Error(message), { status });
}

function isUncertainPostOutcome(error: unknown): boolean {
  if (!(error instanceof AssociatesApiError) || error.operation !== "CREATE_ASSOCIATE") return false;
  return error.kind === "TIMEOUT" || error.kind === "TRANSPORT_ERROR" || error.kind === "HTTP_409" || error.kind === "HTTP_5XX" || error.kind === "INVALID_RESPONSE";
}

/** Compares SIE only with the frozen payload, never current application data. */
function reconcileSnapshot(snapshot: AssociateRequestPayloadSnapshot, state: SieAssociateState): ReconciliationResult {
  if (state.status === false) return "ABSENT";
  const expected = snapshot.servicios;
  if (!expected.length || expected.some((service) => service.moneda !== "S/" || !Number.isSafeInteger(service.anno) || moneyMinor(service.monto) === null)) return "AMBIGUOUS";

  const exact = expected.every((service) => state.cuotas.some((remote) => sameService(service, remote)));
  if (exact) return "MATCH";

  for (const service of expected) {
    const samePeriod = state.cuotas.filter((remote) => remote.concepto === service.concepto && remote.anno === service.anno);
    if (samePeriod.some((remote) => remote.estadoContable !== "Facturado" || !remote.fechaInicio || !remote.fechaFin)) return "AMBIGUOUS";
    if (samePeriod.length) return "CONFLICT";
    // An inscription is unique for a person. A different one means the remote
    // identity/history contradicts this enrollment, not an absent operation.
    if (service.concepto === "INSCRIPCION" && state.cuotas.some((remote) => remote.concepto === "INSCRIPCION")) return "CONFLICT";
  }
  return "ABSENT";
}

function sameService(expected: AssociateRequestPayloadSnapshot["servicios"][number], remote: SieAssociateStateQuota): boolean {
  return remote.estadoContable === "Facturado" && expected.concepto === remote.concepto && expected.anno === remote.anno && expected.moneda === remote.moneda && moneyMinor(expected.monto) === moneyMinor(remote.monto);
}

function moneyMinor(value: number): number | null {
  if (!Number.isFinite(value) || value < 0) return null;
  const minor = Math.round(value * 100);
  return Number.isSafeInteger(minor) && Math.abs(value * 100 - minor) < 1e-7 ? minor : null;
}

function determineRenewalPeriod(cuotas: SieAssociateStateQuota[], snapshot: AssociateRequestPayloadSnapshot): { anno: number } {
  const localQuota = snapshot.servicios.filter((service) => service.concepto === "CUOTA");
  if (localQuota.length !== 1 || localQuota[0].moneda !== "S/") {
    throw new SieStateClassificationError("INVALID_LOCAL_RENEWAL_QUOTA", "La cuota local no permite clasificar una renovacion segura.");
  }

  const historical = cuotas.filter((quota) => quota.concepto === "CUOTA");
  if (!historical.length) {
    throw new SieStateClassificationError("SIE_RENEWAL_HISTORY_MISSING", "SIE identifica al asociado, pero no entrega una cuota utilizable para determinar su renovacion.");
  }
  if (historical.some((quota) => quota.estadoContable !== "Facturado" || !quota.fechaInicio || !quota.fechaFin)) {
    throw new SieStateClassificationError("SIE_RENEWAL_HISTORY_AMBIGUOUS", "SIE contiene cuotas pendientes o sin periodo final utilizable.");
  }
  if (historical.some((quota) => quota.moneda !== localQuota[0].moneda)) {
    throw new SieStateClassificationError("SIE_RENEWAL_CURRENCY_MISMATCH", "La moneda historica de SIE no coincide con la cuota local esperada.");
  }

  const periodKeys = new Set<string>();
  const years = new Set<number>();
  const numbers = new Set<number>();
  for (const quota of historical) {
    if (quota.fechaInicio > quota.fechaFin) {
      throw new SieStateClassificationError("SIE_RENEWAL_HISTORY_AMBIGUOUS", "SIE contiene un periodo de cuota inconsistente.");
    }
    const periodKey = `${quota.fechaInicio}|${quota.fechaFin}`;
    if (periodKeys.has(periodKey) || years.has(quota.anno) || numbers.has(quota.numero!)) {
      throw new SieStateClassificationError("SIE_RENEWAL_HISTORY_AMBIGUOUS", "SIE contiene cuotas duplicadas o periodos incompatibles.");
    }
    periodKeys.add(periodKey);
    years.add(quota.anno);
    numbers.add(quota.numero!);
  }

  const latest = [...historical].sort((left, right) => right.fechaFin.localeCompare(left.fechaFin));
  if (latest.length > 1 && latest[0].fechaFin === latest[1].fechaFin) {
    throw new SieStateClassificationError("SIE_RENEWAL_HISTORY_AMBIGUOUS", "SIE no permite identificar un unico periodo final de cuota.");
  }
  const nextStartDate = nextCalendarDate(latest[0].fechaFin);
  const anno = Number(nextStartDate.slice(0, 4));
  // A matching contractual start date is enough to prohibit another automatic
  // charge. We intentionally do not compare historical amounts: tariffs can
  // legitimately change and the contract does not make that comparison safe.
  if (historical.some((quota) => quota.fechaInicio === nextStartDate)) {
    throw new SieStateClassificationError("SIE_RENEWAL_PERIOD_ALREADY_EXISTS", "SIE ya contiene una cuota para el periodo objetivo.");
  }
  return { anno };
}

function nextCalendarDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new SieStateClassificationError("SIE_RENEWAL_HISTORY_AMBIGUOUS", "SIE no entrego una fecha final valida.");
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new SieStateClassificationError("SIE_RENEWAL_HISTORY_AMBIGUOUS", "SIE no entrego una fecha final valida.");
  }
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function toPersistedError(
  error: unknown,
): AssociateIntegrationError & { retryable: boolean } {
  // Runtime configuration is neither a payload/snapshot validation failure nor
  // a transport attempt. Keep the persisted diagnostic generic and secret-safe.
  if (error instanceof AssociatesApiConfigurationError) {
    return {
      code: "ASSOCIATES_API_CONFIGURATION_MISSING",
      message: "La integración de asociados no está configurada correctamente.",
      retryable: false,
    };
  }
  if (error instanceof SieStateClassificationError) {
    return { code: error.code, message: error.message, retryable: false };
  }
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
