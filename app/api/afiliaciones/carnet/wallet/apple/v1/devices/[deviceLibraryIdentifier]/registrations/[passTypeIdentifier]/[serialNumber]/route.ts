import { NextResponse } from "next/server";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { ApplePassKitService } from "@/modules/afiliaciones/carnet/wallet/Services/ApplePassKitService";
import { WalletError } from "@/modules/afiliaciones/carnet/wallet/Types/wallet";
import { passKitRateLimitKey } from "@/modules/afiliaciones/carnet/wallet/Services/walletIdentity";
import { readApplePassToken } from "@/modules/afiliaciones/carnet/wallet/Api/walletHttp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function passKitError(error: unknown): NextResponse {
  if (error instanceof WalletError) {
    const status = error.code === "FORBIDDEN" ? 401 : error.code === "RATE_LIMITED" ? 429 : error.code === "NOT_FOUND" || error.code === "CARD_NOT_ISSUED" ? 404 : 500;
    return new NextResponse(null, { status, headers: { "Cache-Control": "no-store" } });
  }
  return new NextResponse(null, { status: 500, headers: { "Cache-Control": "no-store" } });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ deviceLibraryIdentifier: string; passTypeIdentifier: string; serialNumber: string }> },
) {
  const token = readApplePassToken(request);
  if (!token) return new NextResponse(null, { status: 401 });
  const path = await params;
  if (!consumeRateLimit(passKitRateLimitKey(path.deviceLibraryIdentifier), 120, 60_000).allowed) {
    return new NextResponse(null, { status: 429 });
  }
  const body = (await request.json().catch(() => null)) as { pushToken?: unknown } | null;
  const pushToken = typeof body?.pushToken === "string" ? body.pushToken.trim() : "";
  if (!/^[0-9a-fA-F]{32,200}$/.test(pushToken)) return new NextResponse(null, { status: 400 });
  try {
    const result = await new ApplePassKitService().register({
      passTypeIdentifier: path.passTypeIdentifier,
      serialNumber: path.serialNumber,
      deviceLibraryIdentifier: path.deviceLibraryIdentifier,
      pushToken,
      authenticationToken: token,
    });
    return new NextResponse(null, { status: result === "created" ? 201 : 200 });
  } catch (error) {
    return passKitError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ deviceLibraryIdentifier: string; passTypeIdentifier: string; serialNumber: string }> },
) {
  const token = readApplePassToken(request);
  if (!token) return new NextResponse(null, { status: 401 });
  const path = await params;
  if (!consumeRateLimit(passKitRateLimitKey(path.deviceLibraryIdentifier), 120, 60_000).allowed) {
    return new NextResponse(null, { status: 429 });
  }
  try {
    await new ApplePassKitService().unregister({
      passTypeIdentifier: path.passTypeIdentifier,
      serialNumber: path.serialNumber,
      deviceLibraryIdentifier: path.deviceLibraryIdentifier,
      authenticationToken: token,
    });
    return new NextResponse(null, { status: 200 });
  } catch (error) {
    return passKitError(error);
  }
}
