import { NextResponse } from "next/server";
import { requireApiPermission } from "@/modules/auth/context/api-authorization";
import { prisma } from "@/lib/prisma";
import { getCardIssuanceEnabled } from "@/lib/config/env";
import { CardError, regenerateCard } from "@/modules/afiliaciones/carnet/Services/cardData";

export async function POST(_: Request, { params }: { params: Promise<{ personId: string }> }) {
  try {
    const user = await requireApiPermission("revoke", "cards");
    if (!getCardIssuanceEnabled()) {
      return NextResponse.json(
        { success: false, code: "ISSUANCE_DISABLED", message: "La emisión de carnets no está habilitada." },
        { status: 503 },
      );
    }
    const personId = Number((await params).personId);
    if (!Number.isInteger(personId) || personId < 1) {
      return NextResponse.json({ success: false, message: "Identificador inválido." }, { status: 400 });
    }

    const regenerated = await regenerateCard(personId);
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "REGENERATE_CARD",
        entity: "AssociateCard",
        entityId: String(personId),
        newValues: { previousTokenRevoked: true },
      },
    });

    return NextResponse.json({ success: true, data: { verificationToken: regenerated.verificationToken } });
  } catch (error) {
    if (error instanceof CardError) {
      return NextResponse.json({ success: false, code: error.code, message: error.message }, { status: 404 });
    }
    const status = error instanceof Error && "status" in error ? Number((error as { status: number }).status) : 403;
    return NextResponse.json({ success: false, message: status === 401 ? "Sesión expirada." : "No autorizado." }, { status });
  }
}
