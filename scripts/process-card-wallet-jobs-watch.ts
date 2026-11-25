import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { getWalletSyncConfig } from "@/lib/config/wallet";
import { CardWalletSyncProcessor } from "@/modules/afiliaciones/carnet/wallet/Services/CardWalletSyncProcessor";

/**
 * Bucle periódico del outbox Wallet. Cada ciclo ejecuta `processOnce()`:
 * recupera leases vencidos, reconcilia pases obsoletos, reclama un lote y
 * procesa los trabajos. Los ciclos son secuenciales (sin solapamiento) y el
 * proceso se detiene de forma controlada con SIGINT/SIGTERM.
 *
 * No ejecuta migraciones, no despliega y no imprime tokens ni datos personales.
 */
export async function runWalletSyncWatch(): Promise<void> {
  const config = getWalletSyncConfig();
  const intervalMs = Math.max(15, config.intervalSeconds) * 1000;
  const processor = new CardWalletSyncProcessor();
  let stopping = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let wake: (() => void) | null = null;

  const stop = (signal: string): void => {
    if (stopping) return;
    stopping = true;
    console.info("[CARD_WALLET_SYNC_WATCH] stopping", { signal });
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (wake) {
      const resolve = wake;
      wake = null;
      resolve();
    }
  };

  process.once("SIGINT", () => stop("SIGINT"));
  process.once("SIGTERM", () => stop("SIGTERM"));

  const sleep = (ms: number): Promise<void> =>
    new Promise<void>((resolve) => {
      wake = resolve;
      timer = setTimeout(() => {
        timer = null;
        wake = null;
        resolve();
      }, ms);
    });

  console.info("[CARD_WALLET_SYNC_WATCH] started", {
    intervalSeconds: config.intervalSeconds,
    batchSize: config.batchSize,
    enabled: config.enabled,
  });

  while (!stopping) {
    const startedAt = Date.now();
    try {
      const result = await processor.processOnce();
      console.info("[CARD_WALLET_SYNC_WATCH] cycle", JSON.stringify({
        disabled: result.disabled,
        recovered: result.recovered,
        reconciled: result.reconciled,
        claimed: result.claimed,
        completed: result.completed,
        requeued: result.requeued,
        retried: result.retried,
        failed: result.failed,
      }));
    } catch (error) {
      console.error("[CARD_WALLET_SYNC_WATCH] cycle_failed", {
        error: error instanceof Error ? error.name : "UnknownError",
      });
    }
    if (stopping) break;
    const elapsed = Date.now() - startedAt;
    await sleep(Math.max(1_000, intervalMs - elapsed));
  }

  await prisma.$disconnect().catch(() => undefined);
  console.info("[CARD_WALLET_SYNC_WATCH] stopped");
}

if (process.argv[1] && process.argv[1].includes("process-card-wallet-jobs-watch")) {
  void runWalletSyncWatch()
    .then(() => {
      process.exitCode = 0;
    })
    .catch((error: unknown) => {
      console.error("[CARD_WALLET_SYNC_WATCH] failed", {
        error: error instanceof Error ? error.name : "UnknownError",
      });
      process.exitCode = 1;
    });
}
