import { NextResponse } from "next/server";
import { requireApiPermission } from "@/modules/auth/context/api-authorization";
import { CardWalletService } from "@/modules/afiliaciones/carnet/wallet/Services/CardWalletService";
import { WalletError } from "@/modules/afiliaciones/carnet/wallet/Types/wallet";
import { WALLET_NO_STORE_HEADERS, walletErrorResponse } from "@/modules/afiliaciones/carnet/wallet/Api/walletHttp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ personId: string }> }) {
  try {
    await requireApiPermission("read", "cards");
    const personId = Number((await params).personId);
    if (!Number.isInteger(personId) || personId < 1) {
      throw new WalletError("INVALID_REQUEST", "Identificador inválido.");
    }
    const data = await new CardWalletService().getStatus(personId);
    return NextResponse.json({ success: true, data }, { headers: WALLET_NO_STORE_HEADERS });
  } catch (error) {
    return walletErrorResponse(error);
  }
}
