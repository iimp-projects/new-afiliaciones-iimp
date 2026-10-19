import { NextResponse } from "next/server";
import { requireApiPermission } from "@/modules/auth/context/api-authorization";
import { getAppBaseUrl } from "@/lib/config/env";
import { getCard, resolveCardData } from "@/modules/afiliaciones/carnet/Services/cardData";
import { generateCardPdf } from "@/modules/afiliaciones/carnet/Services/cardPdf";

export async function GET(_: Request, { params }: { params: Promise<{ personId: string }> }) {
  try {
    await requireApiPermission("read", "cards");
    const personId = Number((await params).personId);
    if (!Number.isInteger(personId) || personId < 1) {
      return NextResponse.json({ success: false, message: "Identificador inválido." }, { status: 400 });
    }

    const data = await resolveCardData(personId);
    const card = await getCard(personId);
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
  } catch (error) {
    const status = error instanceof Error && "status" in error ? Number((error as { status: number }).status) : 403;
    return NextResponse.json({ success: false, message: status === 401 ? "Sesión expirada." : "No autorizado." }, { status });
  }
}
