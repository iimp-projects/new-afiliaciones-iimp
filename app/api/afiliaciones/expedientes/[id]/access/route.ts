import { NextResponse } from "next/server";
import { associateAccessService } from "@/modules/afiliaciones/asociados/Services/AssociateAccessService";
import { contextService } from "@/modules/auth/context/service";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await contextService.requirePermission("read", "memberships");
    const id = Number((await params).id);
    if (!Number.isInteger(id) || id < 1) return NextResponse.json({ success: false, message: "Expediente no encontrado." }, { status: 404 });
    return NextResponse.json({ success: true, data: await associateAccessService.resolve(id) });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "No fue posible consultar el acceso." }, { status: 403 });
  }
}
