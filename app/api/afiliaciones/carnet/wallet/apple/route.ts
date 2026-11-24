import { NextResponse } from "next/server";
import { getWalletSimulationEnabled } from "@/lib/config/wallet";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { contextService } from "@/modules/auth/context/service";
import { CardWalletService } from "@/modules/afiliaciones/carnet/wallet/Services/CardWalletService";
import { WalletError } from "@/modules/afiliaciones/carnet/wallet/Types/wallet";
import {
  WALLET_NO_STORE_HEADERS,
  resolveAffiliatePersonId,
  walletErrorResponse,
} from "@/modules/afiliaciones/carnet/wallet/Api/walletHttp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await contextService.requireAffiliate();
    if (!consumeRateLimit(`wallet:apple:${user.id}`, 10, 60_000).allowed) {
      throw new WalletError("RATE_LIMITED", "Demasiadas solicitudes. Intenta nuevamente en un momento.");
    }
    const personId = await resolveAffiliatePersonId(user.id);
    if (getWalletSimulationEnabled()) {
      const data = await new CardWalletService().getAppleSimulationLink(personId, user.id);
      return NextResponse.json(
        { success: true, data: { ...data, simulated: true } },
        { headers: WALLET_NO_STORE_HEADERS },
      );
    }
    const pass = await new CardWalletService().createApplePass(personId, user.id);
    return new NextResponse(new Uint8Array(pass.buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": `attachment; filename="${pass.fileName}"`,
        ...WALLET_NO_STORE_HEADERS,
      },
    });
  } catch (error) {
    return walletErrorResponse(error);
  }
}
