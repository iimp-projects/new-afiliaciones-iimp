import { prisma } from "@/lib/prisma";
import { CardWalletSyncProcessor } from "@/modules/afiliaciones/carnet/wallet/Services/CardWalletSyncProcessor";

/**
 * Entrypoint one-shot del scheduler Wallet. Procesa un lote de trabajos
 * persistentes (outbox). No ejecuta migraciones, no despliega y no imprime
 * tokens ni datos personales.
 */
export async function runWalletSync(): Promise<number> {
  const processor = new CardWalletSyncProcessor();
  try {
    const result = await processor.processOnce();
    console.info("[CARD_WALLET_SYNC] result", JSON.stringify(result));
    return 0;
  } catch (error) {
    console.error("[CARD_WALLET_SYNC] failed", { error: error instanceof Error ? error.name : "UnknownError" });
    return 1;
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

if (process.argv[1] && process.argv[1].includes("process-card-wallet-jobs")) {
  void runWalletSync().then((code) => {
    process.exitCode = code;
  });
}
