import { NextResponse } from "next/server";
import { requireApiPermission } from "@/modules/auth/context/api-authorization";
import { prisma } from "@/lib/prisma";
import { CardError, revokeCard } from "@/modules/afiliaciones/carnet/Services/cardData";

export async function POST(request: Request, { params }: { params: Promise<{ personId: string }> }) {
  try {
    const user = await requireApiPermission("revoke", "cards");
    const personId = Number((await params).personId);
    if (!Number.isInteger(personId) || personId < 1) {
      return NextResponse.json({ success: false, message: "Identificador inválido." }, { status: 400 });
    }
    const body = await request.json().catch(() => ({}));
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (!reason || reason.length > 500) {
      return NextResponse.json({ success: false, message: "Debe indicar un motivo válido (máximo 500 caracteres)." }, { status: 422 });
    }

    await revokeCard(personId, reason);
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "REVOKE_CARD",
        entity: "AssociateCard",
        entityId: String(personId),
        newValues: { reason },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof CardError) {
      return NextResponse.json({ success: false, code: error.code, message: error.message }, { status: 404 });
    }
    const status = error instanceof Error && "status" in error ? Number((error as { status: number }).status) : 403;
    return NextResponse.json({ success: false, message: status === 401 ? "Sesión expirada." : "No autorizado." }, { status });
  }
}
