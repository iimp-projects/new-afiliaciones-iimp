import { NextResponse } from "next/server";
import { AssociateAccessError, associateAccessService } from "@/modules/afiliaciones/asociados/Services/AssociateAccessService";
import { contextService } from "@/modules/auth/context/service";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await contextService.requireAuth();
    await contextService.requirePermission("update", "memberships");
    const id = Number((await params).id);
    if (!Number.isInteger(id) || id < 1) return NextResponse.json({ success: false, message: "Expediente no encontrado." }, { status: 404 });
    const data = await associateAccessService.resendActivation(id, actor.id);
    return NextResponse.json({ success: true, data, message: "Correo de activación enviado correctamente." });
  } catch (error) {
    const status = error instanceof AssociateAccessError ? error.status : 500;
    return NextResponse.json({ success: false, message: error instanceof AssociateAccessError ? error.message : "No se pudo enviar el correo de activación." }, { status });
  }
}
