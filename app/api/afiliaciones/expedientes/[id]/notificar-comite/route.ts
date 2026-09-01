import { NextRequest, NextResponse } from "next/server";
import { NotifyComiteService } from "@/modules/afiliaciones/expedientes/Services/NotifyComiteService";
import { contextService } from "@/modules/auth/context/service";

export async function POST(
  request: NextRequest, 
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await contextService.requireAuth(); 
    const { id } = await params;
    
    // Capturamos el usuario destino desde el body
    const body = await request.json();
    const targetUserId = body.targetUserId && body.targetUserId !== "ALL" ? Number(body.targetUserId) : undefined;
    
    const actorName = `${currentUser.person.firstName} ${currentUser.person.paternalLastName}`;

    const service = new NotifyComiteService();
    await service.execute(parseInt(id, 10), true, targetUserId, currentUser.id, actorName);

    return NextResponse.json({ success: true, message: "Expediente enviado al Comité correctamente." }, { status: 200 });
  } catch (error: any) {
    console.error("[Notify Comité Error]:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}