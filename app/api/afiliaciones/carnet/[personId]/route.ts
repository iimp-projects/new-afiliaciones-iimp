import { NextResponse } from "next/server";
import { requireApiPermission } from "@/modules/auth/context/api-authorization";
import { contextService } from "@/modules/auth/context/service";
import { getAppBaseUrl, getCardIssuanceEnabled } from "@/lib/config/env";
import { getCard, resolveCardData } from "@/modules/afiliaciones/carnet/Services/cardData";

export async function GET(_: Request, { params }: { params: Promise<{ personId: string }> }) {
  try {
    await requireApiPermission("read", "cards");
    const personId = Number((await params).personId);
    if (!Number.isInteger(personId) || personId < 1) {
      return NextResponse.json({ success: false, message: "Identificador inválido." }, { status: 400 });
    }
    const data = await resolveCardData(personId);
    const card = await getCard(personId);
    const baseUrl = getAppBaseUrl(process.env, { allowDevDefault: true });
    const canManage = await contextService.hasPermission("revoke", "cards");
    return NextResponse.json({
      success: true,
      data: {
        ...data,
        issuanceEnabled: getCardIssuanceEnabled(),
        canManage,
        verificationUrl: card.generated && card.status === "ISSUED" && card.verificationToken
          ? `${baseUrl}/verificar-carnet/${card.verificationToken}`
          : null,
        card: {
          generated: card.generated,
          status: card.status,
          verificationToken: card.verificationToken,
          issuedAt: card.issuedAt ? card.issuedAt.toISOString() : null,
          revokedAt: card.revokedAt ? card.revokedAt.toISOString() : null,
          revokedReason: card.revokedReason,
        },
      },
    });
  } catch (error) {
    const status = error instanceof Error && "status" in error ? Number((error as { status: number }).status) : 403;
    return NextResponse.json({ success: false, message: status === 401 ? "Sesión expirada." : "No autorizado." }, { status });
  }
}
