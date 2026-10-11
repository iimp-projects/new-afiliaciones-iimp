import { NextResponse } from "next/server";
import { contextService } from "@/modules/auth/context/service";
import { prisma } from "@/lib/prisma";
import { getCardIssuanceEnabled } from "@/lib/config/env";
import { CardError, getCard, issueCard, resolveCardData } from "@/modules/afiliaciones/carnet/Services/cardData";

async function ownPersonId(): Promise<number> {
  const user = await contextService.requireAffiliate();
  const account = await prisma.user.findUnique({ where: { id: user.id }, select: { personId: true } });
  if (!account?.personId) throw new Error("No se encontró una persona vinculada a la cuenta.");
  return account.personId;
}

function serializeCard(card: Awaited<ReturnType<typeof getCard>>) {
  return {
    generated: card.generated,
    status: card.status,
    verificationToken: card.verificationToken,
    revokedAt: card.revokedAt ? card.revokedAt.toISOString() : null,
    revokedReason: card.revokedReason,
  };
}

export async function GET() {
  try {
    const personId = await ownPersonId();
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
    const personId = await ownPersonId();
    const data = await resolveCardData(personId);
    if (data.notFound || !data.eligible) {
      return NextResponse.json(
        { success: false, code: "NOT_ELIGIBLE", message: data.reason ?? "Carnet no disponible." },
        { status: 422 },
      );
    }
    const issued = await issueCard(personId);
    return NextResponse.json({
      success: true,
      data: { ...data, card: { generated: true, status: "ISSUED", verificationToken: issued.verificationToken, revokedAt: null, revokedReason: null } },
    });
  } catch (error) {
    if (error instanceof CardError) {
      return NextResponse.json({ success: false, code: error.code, message: error.message }, { status: 409 });
    }
    return NextResponse.json({ success: false, message: "No autorizado." }, { status: 403 });
  }
}
