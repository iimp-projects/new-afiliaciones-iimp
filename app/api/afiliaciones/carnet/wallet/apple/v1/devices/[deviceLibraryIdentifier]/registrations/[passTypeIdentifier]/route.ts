import { NextResponse } from "next/server";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { ApplePassKitService } from "@/modules/afiliaciones/carnet/wallet/Services/ApplePassKitService";
import { WalletError } from "@/modules/afiliaciones/carnet/wallet/Types/wallet";
import { passKitRateLimitKey } from "@/modules/afiliaciones/carnet/wallet/Services/walletIdentity";
import { readApplePassToken } from "@/modules/afiliaciones/carnet/wallet/Api/walletHttp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ deviceLibraryIdentifier: string; passTypeIdentifier: string }> },
) {
  const token = readApplePassToken(request);
  if (!token) return new NextResponse(null, { status: 401 });
  const path = await params;
  if (!consumeRateLimit(passKitRateLimitKey(path.deviceLibraryIdentifier), 120, 60_000).allowed) {
    return new NextResponse(null, { status: 429 });
  }
  try {
    const data = await new ApplePassKitService().listUpdates({
      passTypeIdentifier: path.passTypeIdentifier,
      deviceLibraryIdentifier: path.deviceLibraryIdentifier,
      authenticationToken: token,
      updatedSince: new URL(request.url).searchParams.get("passesUpdatedSince"),
    });
    if (!data) return new NextResponse(null, { status: 204 });
    return NextResponse.json(data, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof WalletError) {
      const status = error.code === "FORBIDDEN" ? 401 : error.code === "NOT_FOUND" || error.code === "CARD_NOT_ISSUED" ? 404 : 500;
      return new NextResponse(null, { status });
    }
    return new NextResponse(null, { status: 500 });
  }
}
