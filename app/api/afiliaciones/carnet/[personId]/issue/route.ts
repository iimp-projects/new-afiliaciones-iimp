import { after, NextResponse } from "next/server";
import { requireApiPermission } from "@/modules/auth/context/api-authorization";
import { prisma } from "@/lib/prisma";
import { getCardIssuanceEnabled } from "@/lib/config/env";
import { CardError, getCard, issueCard, resolveCardData } from "@/modules/afiliaciones/carnet/Services/cardData";
import { enqueueWalletSync, kickWalletSync } from "@/modules/afiliaciones/carnet/wallet/Services/walletSyncQueue";

export async function POST(_: Request, { params }: { params: Promise<{ personId: string }> }) {
  try {
    const user = await requireApiPermission("revoke", "cards");
    const personId = Number((await params).personId);
    if (!Number.isInteger(personId) || personId < 1) {
      return NextResponse.json({ success: false, message: "Identificador inválido." }, { status: 400 });
    }

    const existing = await getCard(personId);
    if (existing.generated && existing.status === "ISSUED" && existing.verificationToken) {
      return NextResponse.json({
        success: true,
        data: existing.verificationToken,
        alreadyIssued: true,
      });
    }

    if (!getCardIssuanceEnabled()) {
      return NextResponse.json(
        { success: false, code: "ISSUANCE_DISABLED", message: "La emisión de carnets no está habilitada." },
        { status: 503 },
      );
    }

    const data = await resolveCardData(personId);
    if (data.notFound) {
      return NextResponse.json({ success: false, code: "NOT_FOUND", message: "Asociado no encontrado." }, { status: 404 });
    }
    if (!data.eligible) {
      return NextResponse.json(
        { success: false, code: "NOT_ELIGIBLE", message: data.reason ?? "Carnet no disponible." },
        { status: 422 },
      );
    }

    const issued = await prisma.$transaction(async (tx) => {
      const result = await issueCard(personId, tx);
      if (result.created) {
        const card = await tx.associateCard.findUnique({ where: { personId }, select: { id: true } });
        if (card) await enqueueWalletSync(tx, card.id, "SYNC");
        await tx.auditLog.create({
          data: {
            userId: user.id,
            action: "ISSUE_CARD",
            entity: "AssociateCard",
            entityId: String(personId),
            newValues: { method: "ADMIN_AUTO" },
          },
        });
      }
      return result;
    });

    after(() => kickWalletSync());

    return NextResponse.json({ success: true, data: issued.verificationToken });
  } catch (error) {
    if (error instanceof CardError) {
      return NextResponse.json({ success: false, code: error.code, message: error.message }, { status: 409 });
    }
    const status = error instanceof Error && "status" in error ? Number((error as { status: number }).status) : 403;
    return NextResponse.json({ success: false, message: status === 401 ? "Sesión expirada." : "No autorizado." }, { status });
  }
}
