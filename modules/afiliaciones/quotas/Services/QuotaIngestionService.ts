import type { QuotaSyncItemStatus } from "@prisma/client";
import { QuotaDomainError } from "../Models/QuotaErrors";
import type { NormalizedQuota, QuotaIngestionInput, QuotaIngestionResult, QuotaSyncItemRecord } from "../Models/QuotaModels";
import type { IQuotaRepository } from "../Repositories/Interfaces/IQuotaRepository";
import type { IQuotaSyncItemRepository } from "../Repositories/Interfaces/IQuotaSyncItemRepository";
import { QuotaIdentityResolver } from "./QuotaIdentityResolver";
import { QuotaNormalizer } from "./QuotaNormalizer";

const ERROR_CODE_PATTERN = /^[A-Z0-9_]{1,100}$/;

export function sanitizeQuotaErrorCode(value: string, fallback = "QUOTA_SYNC_FAILED"): string {
  return ERROR_CODE_PATTERN.test(value) ? value : fallback;
}

/**
 * Fundación de ingesta individual. No consulta el SIE ni itera asociados:
 * recibe una respuesta ya obtenida y persiste cuotas de una sola persona.
 * El motor masivo pertenece a una fase posterior.
 */
export class QuotaIngestionService {
  constructor(
    private readonly quotas: IQuotaRepository,
    private readonly items: IQuotaSyncItemRepository,
    private readonly identityResolver: QuotaIdentityResolver = new QuotaIdentityResolver(),
    private readonly normalizer: QuotaNormalizer = new QuotaNormalizer(),
    private readonly now: () => Date = () => new Date(),
  ) {}

  async ingest(input: QuotaIngestionInput): Promise<QuotaIngestionResult> {
    const startedAt = this.now();
    const identity = this.identityResolver.resolvePerson({
      provider: "SIE",
      documentType: input.documentType,
      documentNumber: input.documentNumber,
    });
    const institutionalCode = this.emptyToNull(input.institutionalCode);
    const item = await this.items.createOrGet({
      syncRunId: input.syncRunId,
      personId: input.personId,
      institutionalCode,
      identityHash: identity.personIdentityHash,
    });
    const running = await this.items.markRunning(item.id, startedAt);

    if (!input.state || input.state.status === false) {
      return this.finish(running, "NOT_FOUND", 0, 0, 0);
    }

    const rawQuotas = input.state.cuotas;
    if (!Array.isArray(rawQuotas)) {
      return this.finish(running, "FAILED", 0, 0, 0, "INVALID_SIE_RESPONSE");
    }
    if (rawQuotas.length === 0) {
      // Respuesta vacía exitosa: no se marca ninguna cuota como ausente.
      return this.finish(running, "NO_DATA", 0, 0, 0);
    }

    let normalized;
    try {
      const existingQuotas = input.personId != null ? await this.quotas.listByPersonId(input.personId) : [];
      const legacyInscriptionYear = existingQuotas.find(
        (quota) => quota.concept === "INSCRIPCION" && quota.sourceKey.endsWith("|INSCRIPCION|INSCRIPCION"),
      )?.year ?? null;
      normalized = this.normalizer.normalizeAll(rawQuotas, {
        provider: "SIE",
        documentType: input.documentType,
        documentNumber: input.documentNumber,
        institutionalCode,
      }, legacyInscriptionYear);
    } catch (error) {
      const code = error instanceof QuotaDomainError ? error.code : "QUOTA_NORMALIZATION_FAILED";
      return this.finish(running, "FAILED", 0, 0, 0, code);
    }

    try {
      const result = await this.quotas.applySuccessfulSync({
        personId: input.personId,
        institutionalCode,
        quotas: normalized,
        syncedAt: this.now(),
      });
      return this.finish(running, "SUCCEEDED", normalized.length, result.inserted, result.updated, null, normalized, result.markedNotPresent);
    } catch (error) {
      const code = error instanceof QuotaDomainError ? error.code : "QUOTA_PERSISTENCE_FAILED";
      return this.finish(running, "FAILED", 0, 0, 0, code);
    }
  }

  async fail(input: Omit<QuotaIngestionInput, "state">, errorCode: string): Promise<QuotaIngestionResult> {
    const startedAt = this.now();
    const identity = this.identityResolver.resolvePerson({
      provider: "SIE",
      documentType: input.documentType,
      documentNumber: input.documentNumber,
    });
    const institutionalCode = this.emptyToNull(input.institutionalCode);
    const item = await this.items.createOrGet({
      syncRunId: input.syncRunId,
      personId: input.personId,
      institutionalCode,
      identityHash: identity.personIdentityHash,
    });
    const running = await this.items.markRunning(item.id, startedAt);
    return this.finish(running, "FAILED", 0, 0, 0, sanitizeQuotaErrorCode(errorCode));
  }

  private async finish(
    item: QuotaSyncItemRecord,
    status: QuotaSyncItemStatus,
    quotasRecovered: number,
    recordsCreated: number,
    recordsUpdated: number,
    errorCode: string | null = null,
    quotas: NormalizedQuota[] = [],
    quotasAbsent = 0,
  ): Promise<QuotaIngestionResult> {
    const finished = await this.items.finish(item.id, {
      status,
      quotasRecovered,
      recordsCreated,
      recordsUpdated,
      errorCode,
      finishedAt: this.now(),
    });
    return {
      item: finished,
      status,
      quotasRecovered,
      inserted: recordsCreated,
      updated: recordsUpdated,
      unchanged: Math.max(0, quotasRecovered - recordsCreated - recordsUpdated),
      quotasAbsent,
      quotas,
    };
  }

  private emptyToNull(value: string | null | undefined): string | null {
    if (typeof value !== "string") return null;
    const normalized = value.trim();
    return normalized ? normalized : null;
  }
}
