import { NextResponse } from "next/server";
import { getWalletConfig } from "@/lib/config/wallet";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { isSameOriginRequest } from "@/lib/security/same-origin";
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

export async function POST(request: Request) {
  try {
    const user = await contextService.requireAffiliate();
    const config = getWalletConfig();
    if (!isSameOriginRequest(request, config.appBaseUrl)) {
      throw new WalletError("ORIGIN_REJECTED", "No pudimos verificar el origen de la solicitud.");
    }
    if (!consumeRateLimit(`wallet:google:${user.id}`, 10, 60_000).allowed) {
      throw new WalletError("RATE_LIMITED", "Demasiadas solicitudes. Intenta nuevamente en un momento.");
    }
    const personId = await resolveAffiliatePersonId(user.id);
    const data = await new CardWalletService().getGoogleLink(personId, user.id);
    return NextResponse.json({ success: true, data }, { headers: WALLET_NO_STORE_HEADERS });
  } catch (error) {
    return walletErrorResponse(error);
  }
}
