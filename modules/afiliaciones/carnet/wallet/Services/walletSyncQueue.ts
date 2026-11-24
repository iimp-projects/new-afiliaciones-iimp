import { getWalletSyncConfig } from "@/lib/config/wallet";
import {
  PrismaCardWalletSyncJobRepository,
  type SyncDatabase,
  type SyncOperation,
} from "../Repositories/CardWalletSyncJobRepository";
import { CardWalletSyncProcessor } from "./CardWalletSyncProcessor";

/**
 * Inserta/actualiza los trabajos de sincronización dentro de la MISMA
 * transacción que la modificación institucional. No realiza llamadas externas.
 */
export async function enqueueWalletSync(
  db: SyncDatabase,
  cardId: string,
  operation: SyncOperation,
): Promise<number> {
  const config = getWalletSyncConfig();
  return new PrismaCardWalletSyncJobRepository().enqueueForCard(db, cardId, operation, config.maxAttempts);
}

/**
 * Acelerador opcional. La persistencia garantiza que el scheduler retome el
 * trabajo aunque este procesamiento en segundo plano no llegue a ejecutarse.
 */
export function kickWalletSync(): void {
  void new CardWalletSyncProcessor()
    .processOnce({ reconcile: false, workerId: "after-response" })
    .catch(() => undefined);
}
