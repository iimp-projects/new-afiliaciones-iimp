import { prisma } from "@/lib/prisma";
import type { WalletProvider } from "../Types/wallet";

export type WalletAuditAction =
  | "CARD_WALLET_GOOGLE_LINK_READY"
  | "CARD_WALLET_APPLE_PASS_GENERATED"
  | "CARD_WALLET_SYNC_SUCCEEDED"
  | "CARD_WALLET_SYNC_FAILED"
  | "CARD_WALLET_PASSKIT_REGISTERED"
  | "CARD_WALLET_PASSKIT_UNREGISTERED"
  | "CARD_WALLET_PASSKIT_AUTH_FAILED";

export interface WalletAuditEvent {
  readonly action: WalletAuditAction;
  readonly personId: number;
  readonly actorUserId?: number | null;
  readonly provider?: WalletProvider;
  readonly outcome: "SUCCESS" | "FAILURE";
  readonly code?: string;
}

/**
 * Auditoría sin datos sensibles: nunca registra tokens, URLs firmadas,
 * identificadores de dispositivo ni contenido del pase.
 */
export async function writeWalletAudit(event: WalletAuditEvent): Promise<void> {
  await prisma.auditLog
    .create({
      data: {
        userId: event.actorUserId ?? null,
        action: event.action,
        entity: "CardWalletPass",
        entityId: String(event.personId),
        newValues: {
          provider: event.provider ?? null,
          outcome: event.outcome,
          code: event.code ?? null,
        },
      },
    })
    .catch(() => undefined);
}
