import { NextResponse } from "next/server";
import { contextService } from "@/modules/auth/context/service";
import { prisma } from "@/lib/prisma";
import { getAppBaseUrl } from "@/lib/config/env";
import { getCard, resolveCardData } from "@/modules/afiliaciones/carnet/Services/cardData";
import { generateCardPdf } from "@/modules/afiliaciones/carnet/Services/cardPdf";

export async function GET() {
  try {
    const user = await contextService.requireAffiliate();
    const account = await prisma.user.findUnique({ where: { id: user.id }, select: { personId: true } });
    if (!account?.personId) {
      return NextResponse.json({ success: false, message: "No se encontró una persona vinculada a la cuenta." }, { status: 404 });
    }

    const data = await resolveCardData(account.personId);
    const card = await getCard(account.personId);
    if (!card.generated || card.status !== "ISSUED" || !card.verificationToken) {
      return NextResponse.json({ success: false, message: "El carnet no está disponible." }, { status: 404 });
    }

    const baseUrl = getAppBaseUrl(process.env, { allowDevDefault: true });
    const pdf = await generateCardPdf({
      name: data.name,
      code: data.code,
      category: data.category,
      photoUrl: data.photoUrl,
      verificationUrl: `${baseUrl}/verificar-carnet/${card.verificationToken}`,
    });

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="Carnet_IIMP.pdf"',
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ success: false, message: "No autorizado." }, { status: 403 });
  }
}
