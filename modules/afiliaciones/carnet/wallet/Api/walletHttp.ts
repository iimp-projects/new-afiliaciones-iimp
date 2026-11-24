import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { WalletError } from "../Types/wallet";

export const WALLET_NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
} as const;

export async function resolveAffiliatePersonId(userId: number): Promise<number> {
  const account = await prisma.user.findUnique({ where: { id: userId }, select: { personId: true } });
  if (!account?.personId) throw new WalletError("FORBIDDEN", "No encontramos una persona vinculada a tu cuenta.");
  return account.personId;
}

export function walletErrorResponse(error: unknown): NextResponse {
  if (error instanceof WalletError) {
    return NextResponse.json(
      { success: false, code: error.code, message: error.userMessage },
      { status: error.status, headers: WALLET_NO_STORE_HEADERS },
    );
  }
  const status = error instanceof Error && "status" in error ? Number((error as { status: number }).status) : 403;
  return NextResponse.json(
    { success: false, message: status === 401 ? "Sesión expirada." : "No autorizado." },
    { status, headers: WALLET_NO_STORE_HEADERS },
  );
}

export function readApplePassToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const [scheme, token] = header.trim().split(/\s+/, 2);
  if (scheme !== "ApplePass" || !token) return null;
  return token;
}
