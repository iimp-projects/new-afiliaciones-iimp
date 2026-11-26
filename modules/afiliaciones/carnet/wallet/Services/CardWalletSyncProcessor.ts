import { randomUUID } from "node:crypto";
import { getWalletSyncConfig, type WalletSyncConfig } from "@/lib/config/wallet";
import { PrismaCardWalletRepository, type CardWalletRepository } from "../Repositories/CardWalletRepository";
import {
  PrismaCardWalletSyncJobRepository,
  type CardWalletSyncJobRepository,
  type SyncJobRow,
  type SyncMetrics,
} from "../Repositories/CardWalletSyncJobRepository";
import { WalletError } from "../Types/wallet";
import { CardWalletService, type WalletSyncResult } from "./CardWalletService";

const PERMANENT_ERROR_CODES = new Set([
  "PROVIDER_NOT_CONFIGURED",
  "PROVIDER_DISABLED",
  "CARD_NOT_ISSUED",
  "CARD_REVOKED",
  "NOT_FOUND",
  "FORBIDDEN",
  "ALLOWLIST_BLOCKED",
]);

export function isPermanentSyncError(code: string | undefined): boolean {
  return Boolean(code && PERMANENT_ERROR_CODES.has(code));
}

/** Backoff exponencial con jitter, acotado a 1 hora. */
export function computeBackoffDelayMs(attemptCount: number, random: () => number = Math.random): number {
  const baseMs = 30_000;
  const capMs = 60 * 60 * 1000;
  const exponential = Math.min(capMs, baseMs * 2 ** Math.max(0, attemptCount));
  const jitter = exponential * 0.2 * Math.min(1, Math.max(0, random()));
  return Math.min(capMs, Math.floor(exponential + jitter));
}

export interface SyncRunResult {
  readonly disabled: boolean;
  readonly recovered: number;
  readonly reconciled: number;
  readonly claimed: number;
  readonly completed: number;
  readonly requeued: number;
  readonly retried: number;
  readonly failed: number;
  readonly metrics: SyncMetrics | null;
}

export interface CardWalletSyncProcessorDeps {
  readonly repo?: CardWalletSyncJobRepository;
  readonly cardRepo?: Pick<CardWalletRepository, "getCardPersonId">;
  readonly walletService?: Pick<CardWalletService, "syncProvider">;
  readonly getConfig?: (env?: Record<string, string | undefined>) => WalletSyncConfig;
  readonly random?: () => number;
  readonly now?: () => Date;
  readonly log?: (event: Record<string, unknown>) => void;
}

/**
 * Procesador de trabajos de sincronización. La adquisición usa leases y
 * `FOR UPDATE SKIP LOCKED`; el estado institucional se relee antes de cada
 * llamada externa y nunca se ejecuta HTTP dentro de una transacción de BD.
 */
export class CardWalletSyncProcessor {
  private readonly repo: CardWalletSyncJobRepository;
  private readonly cardRepo: Pick<CardWalletRepository, "getCardPersonId">;
  private readonly walletService: Pick<CardWalletService, "syncProvider">;
  private readonly getConfig: NonNullable<CardWalletSyncProcessorDeps["getConfig"]>;
  private readonly random: () => number;
  private readonly now: () => Date;
  private readonly log: (event: Record<string, unknown>) => void;

  constructor(deps: CardWalletSyncProcessorDeps = {}) {
    this.repo = deps.repo ?? new PrismaCardWalletSyncJobRepository();
    this.cardRepo = deps.cardRepo ?? new PrismaCardWalletRepository();
    this.walletService = deps.walletService ?? new CardWalletService();
    this.getConfig = deps.getConfig ?? (() => getWalletSyncConfig());
    this.random = deps.random ?? Math.random;
    this.now = deps.now ?? (() => new Date());
    this.log = deps.log ?? ((event) => console.info(JSON.stringify(event)));
  }

  async processOnce(options: { force?: boolean; reconcile?: boolean; workerId?: string } = {}): Promise<SyncRunResult> {
    const config = this.getConfig();
    if (!config.enabled && !options.force) {
      return { disabled: true, recovered: 0, reconciled: 0, claimed: 0, completed: 0, requeued: 0, retried: 0, failed: 0, metrics: await this.repo.metrics().catch(() => null) };
    }

    const workerId = `${options.workerId ?? `wallet-worker-${process.pid}`}-${randomUUID()}`;
    const recovered = await this.repo.recoverExpired(config.leaseSeconds);
    const reconciled = options.reconcile === false ? 0 : await this.repo.reconcileStale(config.batchSize, config.maxAttempts, 24);
    const jobs = await this.repo.claimBatch(workerId, config.batchSize, config.leaseSeconds);

    const result = { completed: 0, requeued: 0, retried: 0, failed: 0 };
    for (let index = 0; index < jobs.length; index += 1) {
      const job = jobs[index];
      await this.repo.renewLeases(jobs.slice(index).map((entry) => entry.id), workerId, config.leaseSeconds).catch(() => undefined);
      const outcome = await this.processJob(job, workerId);
      if (outcome === "completed") result.completed += 1;
      else if (outcome === "requeued") result.requeued += 1;
      else if (outcome === "retried") result.retried += 1;
      else result.failed += 1;
    }

    const metrics = await this.repo.metrics().catch(() => null);
    const run: SyncRunResult = {
      disabled: false,
      recovered,
      reconciled,
      claimed: jobs.length,
      ...result,
      metrics,
    };
    this.log({ event: "card_wallet_sync_run", ...run });
    return run;
  }

  /** Reintento manual desde administración; no espera al scheduler. */
  async retryCard(cardId: string): Promise<SyncRunResult> {
    await this.repo.requeueForCard(cardId);
    return this.processOnce({ force: true, reconcile: false, workerId: "wallet-admin-retry" });
  }

  private async processJob(
    job: SyncJobRow,
    workerId: string,
  ): Promise<"completed" | "requeued" | "retried" | "failed"> {
    try {
      const personId = await this.cardRepo.getCardPersonId(job.cardId);
      if (!personId) return this.handleFailure(job, workerId, "NOT_FOUND", "El carné ya no existe.");
      const result = await this.walletService.syncProvider(personId, job.provider);
      if (result.status === "FAILED") return this.handleFailure(job, workerId, result.code, "El proveedor rechazó la sincronización.");
      const completed = await this.repo.complete(job.id, workerId, job.updatedAt, job.operation);
      return completed ? "completed" : "requeued";
    } catch (error) {
      const code = error instanceof WalletError ? error.code : "SYNC_ERROR";
      const message = error instanceof WalletError ? error.userMessage : "No pudimos sincronizar el pase.";
      return this.handleFailure(job, workerId, code, message);
    }
  }

  private async handleFailure(
    job: SyncJobRow,
    workerId: string,
    code: string | undefined,
    message: string,
  ): Promise<"retried" | "failed"> {
    const errorCode = code ?? "SYNC_ERROR";
    const nextAttempt = job.attemptCount + 1;
    if (isPermanentSyncError(errorCode) || nextAttempt >= job.maxAttempts) {
      await this.repo.fail(job.id, workerId, errorCode, message);
      return "failed";
    }
    const delay = computeBackoffDelayMs(job.attemptCount, this.random);
    await this.repo.retry(job.id, workerId, new Date(this.now().getTime() + delay), errorCode, message);
    return "retried";
  }
}

/** Clasificación expuesta para pruebas y documentación. */
export function classifySyncResult(result: WalletSyncResult): "transient" | "permanent" | "success" {
  if (result.status !== "FAILED") return "success";
  return isPermanentSyncError(result.code) ? "permanent" : "transient";
}
