import { NextResponse } from "next/server";
import { z } from "zod";
import { AssociateAccessError, associateAccessService } from "@/modules/afiliaciones/asociados/Services/AssociateAccessService";
import { contextService } from "@/modules/auth/context/service";

const schema = z.object({ email: z.string().trim().email() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await contextService.requireAuth();
    await contextService.requirePermission("update", "memberships");
    const id = Number((await params).id);
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!Number.isInteger(id) || id < 1) return NextResponse.json({ success: false, message: "Expediente no encontrado." }, { status: 404 });
    if (!parsed.success) return NextResponse.json({ success: false, message: "Ingresa un correo electrónico válido." }, { status: 422 });
    const data = await associateAccessService.changeEmailAndProvision(id, parsed.data.email, actor.id);
    return NextResponse.json({ success: true, data, message: data.status === "PENDING_ACTIVATION" ? "El acceso fue habilitado y se envió el correo de activación." : data.message });
  } catch (error) {
    const status = error instanceof AssociateAccessError ? error.status : 500;
    return NextResponse.json({ success: false, message: error instanceof AssociateAccessError ? error.message : "No fue posible cambiar el correo de acceso." }, { status });
  }
}
