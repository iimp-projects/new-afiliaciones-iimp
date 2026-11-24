import { after, NextResponse } from "next/server";
import { contextService } from "@/modules/auth/context/service";
import { prisma } from "@/lib/prisma";
import { getCardIssuanceEnabled } from "@/lib/config/env";
import { CardError, getCard, issueCard, resolveCardData } from "@/modules/afiliaciones/carnet/Services/cardData";
import { enqueueWalletSync, kickWalletSync } from "@/modules/afiliaciones/carnet/wallet/Services/walletSyncQueue";

async function ownAccount(): Promise<{ userId: number; personId: number }> {
  const user = await contextService.requireAffiliate();
  const account = await prisma.user.findUnique({ where: { id: user.id }, select: { personId: true } });
  if (!account?.personId) throw new Error("No se encontró una persona vinculada a la cuenta.");
  return { userId: user.id, personId: account.personId };
}

function serializeCard(card: Awaited<ReturnType<typeof getCard>>) {
  return {
    generated: card.generated,
    status: card.status,
    verificationToken: card.verificationToken,
    issuedAt: card.issuedAt ? card.issuedAt.toISOString() : null,
    revokedAt: card.revokedAt ? card.revokedAt.toISOString() : null,
    revokedReason: card.revokedReason,
  };
}

export async function GET() {
  try {
    const { personId } = await ownAccount();
    const data = await resolveCardData(personId);
    const card = await getCard(personId);
    return NextResponse.json({ success: true, data: { ...data, card: serializeCard(card) } });
  } catch {
    return NextResponse.json({ success: false, message: "No autorizado." }, { status: 403 });
  }
}

export async function POST() {
  try {
    if (!getCardIssuanceEnabled()) {
      return NextResponse.json(
        { success: false, code: "ISSUANCE_DISABLED", message: "La emisión de carnets no está habilitada." },
        { status: 503 },
      );
    }
    const { userId, personId } = await ownAccount();
    const data = await resolveCardData(personId);
    if (data.notFound || !data.eligible) {
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
            userId,
            action: "ISSUE_CARD",
            entity: "AssociateCard",
            entityId: String(personId),
            newValues: { method: "PORTAL_AUTO" },
          },
        });
      }
      return result;
    });
    after(() => kickWalletSync());

    const card = await getCard(personId);
    return NextResponse.json({ success: true, data: { ...data, card: serializeCard(card) } });
  } catch (error) {
    if (error instanceof CardError) {
      return NextResponse.json({ success: false, code: error.code, message: error.message }, { status: 409 });
    }
    return NextResponse.json({ success: false, message: "No autorizado." }, { status: 403 });
  }
}
