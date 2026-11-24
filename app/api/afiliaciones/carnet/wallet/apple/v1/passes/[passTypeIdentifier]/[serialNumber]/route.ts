import { NextResponse } from "next/server";
import { ApplePassKitService } from "@/modules/afiliaciones/carnet/wallet/Services/ApplePassKitService";
import { WalletError } from "@/modules/afiliaciones/carnet/wallet/Types/wallet";
import { readApplePassToken } from "@/modules/afiliaciones/carnet/wallet/Api/walletHttp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ passTypeIdentifier: string; serialNumber: string }> },
) {
  const token = readApplePassToken(request);
  if (!token) return new NextResponse(null, { status: 401 });
  const path = await params;
  try {
    const result = await new ApplePassKitService().latestPass({
      passTypeIdentifier: path.passTypeIdentifier,
      serialNumber: path.serialNumber,
      authenticationToken: token,
      ifModifiedSince: request.headers.get("if-modified-since"),
    });
    if (result.notModified || !result.buffer) {
      return new NextResponse(null, { status: 304, headers: { "Cache-Control": "no-store" } });
    }
    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.pkpass",
        "Last-Modified": result.lastModified?.toUTCString() ?? new Date().toUTCString(),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof WalletError) {
      const status = error.code === "FORBIDDEN" ? 401 : error.code === "NOT_FOUND" || error.code === "CARD_NOT_ISSUED" ? 404 : 500;
      return new NextResponse(null, { status });
    }
    return new NextResponse(null, { status: 500 });
  }
}
