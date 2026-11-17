import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { contextService } from "@/modules/auth/context/service";
import { isAffiliateUser } from "@/modules/auth/context/types";
import { EndorsementHistoryRepository } from "@/modules/afiliaciones/endorsements/Repositories/EndorsementHistoryRepository";
import {
  ReviewEndorsementError,
  ReviewEndorsementService,
} from "@/modules/afiliaciones/postulacion/Services/ReviewEndorsementService";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ action: z.enum(["APPROVE", "REJECT"]) });

/**
 * POST /api/mi-cuenta/avales/:id/review
 *
 * Permite al asociado autenticado aprobar o rechazar un aval propio pendiente
 * desde el módulo "Mis avales", reutilizando el mismo caso de uso que el enlace
 * por correo. La identidad y la propiedad del aval se validan en el servidor
 * (`userId → personId` y `sponsorPersonId` del aval).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await contextService.getCurrentUser();
  if (!user || user.status !== "ACTIVE" || user.mustChangePassword || !isAffiliateUser(user)) {
    return NextResponse.json({ success: false, message: "No autorizado." }, { status: 403 });
  }

  const approvalId = Number((await params).id);
  if (!Number.isSafeInteger(approvalId) || approvalId <= 0) {
    return NextResponse.json({ success: false, message: "Aval inválido." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "Acción inválida." }, { status: 400 });
  }

  const personId = await new EndorsementHistoryRepository().personIdForUser(user.id);
  if (!personId) {
    return NextResponse.json({ success: false, message: "No se encontró el aval." }, { status: 404 });
  }

  const ipAddress =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    undefined;
  const userAgent = request.headers.get("user-agent") || undefined;

  try {
    await new ReviewEndorsementService().reviewOwned(approvalId, personId, parsed.data.action, {
      ipAddress,
      userAgent,
    });
    return NextResponse.json({
      success: true,
      message:
        parsed.data.action === "APPROVE"
          ? "Aval aprobado correctamente."
          : "Aval rechazado correctamente.",
    });
  } catch (error) {
    if (error instanceof ReviewEndorsementError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.code === "NOT_FOUND" ? 404 : 409 },
      );
    }
    return NextResponse.json(
      { success: false, message: "No fue posible registrar tu respuesta." },
      { status: 500 },
    );
  }
}
