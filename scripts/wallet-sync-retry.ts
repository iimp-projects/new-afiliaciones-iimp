import "dotenv/config";
import { CardWalletSyncProcessor } from "@/modules/afiliaciones/carnet/wallet/Services/CardWalletSyncProcessor";

/**
 * Reintento idempotente de trabajos de sincronizacion Wallet por carné.
 *
 * - Sin `--confirm` solo informa (no toca la BD ni llama proveedores).
 * - Con `--confirm` reencola los trabajos del carné y procesa una pasada.
 *
 * NO ejecutar contra QA sin autorizacion explicita: puede invocar al proveedor
 * Wallet real. Uso:
 *   npx tsx scripts/wallet-sync-retry.ts --card <cardId>
 *   npx tsx scripts/wallet-sync-retry.ts --card <cardId> --confirm
 */

function value(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  const next = process.argv[index + 1];
  return next && !next.startsWith("--") ? next : null;
}

async function main(): Promise<void> {
  const cardId = value("--card");
  const confirm = process.argv.includes("--confirm");
  if (!cardId) {
    console.error("Uso: npx tsx scripts/wallet-sync-retry.ts --card <cardId> [--confirm]");
    process.exit(1);
  }
  if (!confirm) {
    console.info(`[wallet-retry] DRY-RUN para card=${cardId}. No se ejecuto ningun cambio ni llamada externa.`);
    console.info("[wallet-retry] Para ejecutar (requiere autorizacion): anadir --confirm");
    return;
  }

  const run = await new CardWalletSyncProcessor().retryCard(cardId);
  console.info(JSON.stringify({ event: "wallet_sync_manual_retry", cardId, ...run }));
}

main().catch((error) => {
  console.error(`[wallet-retry] Error: ${(error as Error).message}`);
  process.exit(1);
});
