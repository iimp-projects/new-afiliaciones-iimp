import { NextResponse } from "next/server";
import { requireApiPermission } from "@/modules/auth/context/api-authorization";
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
    return NextResponse.json({
      success: true,
      data: {
        ...data,
        card: {
          generated: card.generated,
          status: card.status,
          verificationToken: card.verificationToken,
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
