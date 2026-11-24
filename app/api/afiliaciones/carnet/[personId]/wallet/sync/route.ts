import { NextResponse } from "next/server";
import { getWalletConfig } from "@/lib/config/wallet";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { isSameOriginRequest } from "@/lib/security/same-origin";
import { requireApiPermission } from "@/modules/auth/context/api-authorization";
import { getCardRecord } from "@/modules/afiliaciones/carnet/Services/cardData";
import { CardWalletSyncProcessor } from "@/modules/afiliaciones/carnet/wallet/Services/CardWalletSyncProcessor";
import { enqueueWalletSync } from "@/modules/afiliaciones/carnet/wallet/Services/walletSyncQueue";
import { WalletError } from "@/modules/afiliaciones/carnet/wallet/Types/wallet";
import { WALLET_NO_STORE_HEADERS, walletErrorResponse } from "@/modules/afiliaciones/carnet/wallet/Api/walletHttp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ personId: string }> }) {
  try {
    const user = await requireApiPermission("revoke", "cards");
    if (!isSameOriginRequest(request, getWalletConfig().appBaseUrl)) {
      throw new WalletError("ORIGIN_REJECTED", "No pudimos verificar el origen de la solicitud.");
    }
    const personId = Number((await params).personId);
    if (!Number.isInteger(personId) || personId < 1) {
      throw new WalletError("INVALID_REQUEST", "Identificador inválido.");
    }
    if (!consumeRateLimit(`wallet:admin-sync:${user.id}:${personId}`, 5, 60_000).allowed) {
      throw new WalletError("RATE_LIMITED", "Demasiadas solicitudes. Intenta nuevamente en un momento.");
    }
    const card = await getCardRecord(personId);
    if (!card) throw new WalletError("CARD_NOT_ISSUED", "El asociado aún no tiene un carné emitido.");
    await prisma.$transaction((tx) => enqueueWalletSync(tx, card.id, "SYNC"));
    const run = await new CardWalletSyncProcessor().processOnce({
      force: true,
      reconcile: false,
      workerId: `wallet-admin-${user.id}`,
    });
    return NextResponse.json({ success: true, data: run }, { headers: WALLET_NO_STORE_HEADERS });
  } catch (error) {
    return walletErrorResponse(error);
  }
}
