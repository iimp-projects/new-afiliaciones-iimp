import { NextRequest, NextResponse } from "next/server";
import { NotifyComiteService } from "@/modules/afiliaciones/expedientes/Services/NotifyComiteService";
import { apiAuthorizationStatus, requireApiPermission } from "@/modules/auth/context/api-authorization";

export async function POST(
  request: NextRequest, 
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await requireApiPermission("update", "memberships");
    const { id } = await params;
    
    // Capturamos el usuario destino desde el body
    const body = await request.json();
    const targetUserId = body.targetUserId && body.targetUserId !== "ALL" ? Number(body.targetUserId) : undefined;
    
    const actorName = `${currentUser.person.firstName} ${currentUser.person.paternalLastName}`;

    const service = new NotifyComiteService();
    await service.execute(parseInt(id, 10), true, targetUserId, currentUser.id, actorName);

    return NextResponse.json({ success: true, message: "Expediente enviado al Comité correctamente." }, { status: 200 });
  } catch (error: unknown) {
    console.error("[Notify Comité Error]:", error);
    const status = apiAuthorizationStatus(error, 500);
    return NextResponse.json({ success: false, error: status < 500 ? "No autorizado." : "No se pudo notificar al comité." }, { status });
  }
}
