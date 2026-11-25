import { describe, expect, it, vi } from "vitest";
import type { WalletSyncConfig } from "@/lib/config/wallet";
import type { CardWalletSyncJobRepository, SyncJobRow, SyncMetrics } from "../Repositories/CardWalletSyncJobRepository";
import { CardWalletSyncProcessor, computeBackoffDelayMs, isPermanentSyncError } from "../Services/CardWalletSyncProcessor";
import { WalletError } from "../Types/wallet";

const config: WalletSyncConfig = { enabled: true, batchSize: 25, maxAttempts: 8, leaseSeconds: 120, intervalSeconds: 60 };
const metrics: SyncMetrics = { pending: 0, processing: 0, retry: 0, failed: 0, completed: 0, oldestPendingSeconds: null };

function job(overrides: Partial<SyncJobRow> = {}): SyncJobRow {
  return {
    id: "job-1",
    cardId: "card_abc",
    walletPassId: "pass-1",
    provider: "GOOGLE",
    operation: "SYNC",
    status: "PROCESSING",
    targetVersion: 2,
    attemptCount: 0,
    maxAttempts: 8,
    nextAttemptAt: new Date("2026-11-24T12:00:00Z"),
    lastErrorCode: null,
    updatedAt: new Date("2026-11-24T12:00:00Z"),
    ...overrides,
  };
}

function repo(jobs: SyncJobRow[] = [job()]) {
  return {
    recoverExpired: vi.fn(async () => 0),
    reconcileStale: vi.fn(async () => 0),
    claimBatch: vi.fn(async () => jobs),
    complete: vi.fn(async () => true),
    renewLeases: vi.fn(async () => 1),
    retry: vi.fn(async () => true),
    fail: vi.fn(async () => true),
    requeueForCard: vi.fn(async () => 0),
    listByCard: vi.fn(async () => []),
    metrics: vi.fn(async () => metrics),
    enqueueForCard: vi.fn(async () => 0),
  } as unknown as CardWalletSyncJobRepository;
}

function processor(r: CardWalletSyncJobRepository, syncProvider = vi.fn(async () => ({ provider: "GOOGLE" as const, status: "SYNCED" as const })), getConfig = () => config) {
  const log = vi.fn();
  return {
    log,
    processor: new CardWalletSyncProcessor({
      repo: r,
      cardRepo: { getCardPersonId: async () => 1 },
      walletService: { syncProvider } as never,
      getConfig,
      random: () => 0,
      now: () => new Date("2026-11-24T12:00:00Z"),
      log,
    }),
  };
}

describe("CardWalletSyncProcessor", () => {
  it("no procesa si el scheduler está deshabilitado", async () => {
    const r = repo();
    const { processor: p } = processor(r, undefined, () => ({ ...config, enabled: false }));
    const result = await p.processOnce();
    expect(result.disabled).toBe(true);
    expect(r.claimBatch).not.toHaveBeenCalled();
  });

  it("completa un trabajo cuando el proveedor sincroniza", async () => {
    const r = repo();
    const { processor: p, log } = processor(r);
    const result = await p.processOnce();
    expect(result.completed).toBe(1);
    expect(r.renewLeases).toHaveBeenCalledWith(["job-1"], expect.any(String), 120);
    expect(r.complete).toHaveBeenCalledWith("job-1", expect.any(String), new Date("2026-11-24T12:00:00Z"), "SYNC");
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ event: "card_wallet_sync_run", completed: 1 }));
  });

  it("reencola si el pase cambió mientras se procesaba", async () => {
    const r = repo();
    (r.complete as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);
    const { processor: p } = processor(r);
    const result = await p.processOnce();
    expect(result.requeued).toBe(1);
    expect(result.completed).toBe(0);
  });

  it("reintenta fallos transitorios con backoff", async () => {
    const r = repo();
    const syncProvider = vi.fn(async () => ({ provider: "GOOGLE" as const, status: "FAILED" as const, code: "PROVIDER_ERROR" }));
    const { processor: p } = processor(r, syncProvider as never);
    const result = await p.processOnce();
    expect(result.retried).toBe(1);
    expect(r.retry).toHaveBeenCalledWith(
      "job-1",
      expect.any(String),
      new Date("2026-11-24T12:00:30.000Z"),
      "PROVIDER_ERROR",
      expect.any(String),
    );
  });

  it("no reintenta errores permanentes de configuración", async () => {
    const r = repo();
    const syncProvider = vi.fn(async () => ({ provider: "APPLE" as const, status: "FAILED" as const, code: "PROVIDER_NOT_CONFIGURED" }));
    const { processor: p } = processor(r, syncProvider as never);
    const result = await p.processOnce();
    expect(result.failed).toBe(1);
    expect(r.fail).toHaveBeenCalled();
    expect(r.retry).not.toHaveBeenCalled();
  });

  it("falla al agotar los intentos", async () => {
    const r = repo([job({ attemptCount: 7, maxAttempts: 8 })]);
    const syncProvider = vi.fn(async () => ({ provider: "GOOGLE" as const, status: "FAILED" as const, code: "PROVIDER_ERROR" }));
    const { processor: p } = processor(r, syncProvider as never);
    const result = await p.processOnce();
    expect(result.failed).toBe(1);
    expect(r.fail).toHaveBeenCalled();
  });

  it("convierte excepciones del coordinador en reintentos", async () => {
    const r = repo();
    const syncProvider = vi.fn(async () => { throw new WalletError("PROVIDER_ERROR", "Proveedor no disponible."); });
    const { processor: p } = processor(r, syncProvider as never);
    const result = await p.processOnce();
    expect(result.retried).toBe(1);
  });

  it("marca como fallido un carné inexistente", async () => {
    const r = repo();
    const p = new CardWalletSyncProcessor({
      repo: r,
      cardRepo: { getCardPersonId: async () => null },
      walletService: { syncProvider: vi.fn() } as never,
      getConfig: () => config,
      log: vi.fn(),
    });
    const result = await p.processOnce();
    expect(result.failed).toBe(1);
    expect(r.fail).toHaveBeenCalledWith("job-1", expect.any(String), "NOT_FOUND", expect.any(String));
  });
});

describe("backoff y clasificación", () => {
  it("crece exponencialmente y respeta el tope", () => {
    expect(computeBackoffDelayMs(0, () => 0)).toBe(30_000);
    expect(computeBackoffDelayMs(1, () => 0)).toBe(60_000);
    expect(computeBackoffDelayMs(2, () => 0)).toBe(120_000);
    expect(computeBackoffDelayMs(20, () => 0)).toBe(3_600_000);
    expect(computeBackoffDelayMs(0, () => 1)).toBe(36_000);
  });

  it("clasifica errores permanentes y transitorios", () => {
    expect(isPermanentSyncError("PROVIDER_NOT_CONFIGURED")).toBe(true);
    expect(isPermanentSyncError("CARD_NOT_ISSUED")).toBe(true);
    expect(isPermanentSyncError("PROVIDER_ERROR")).toBe(false);
    expect(isPermanentSyncError(undefined)).toBe(false);
  });
});
