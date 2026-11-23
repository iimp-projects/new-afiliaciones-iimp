import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiAuthorizationError, requireApiPermission } from "@/modules/auth/context/api-authorization";
import { adminAssociateDataSchema } from "@/modules/afiliaciones/asociados/Validators/AdminAssociateDataSchema";
import { AssociateAdminDataError, AssociateAdminDataService, AssociateAdminDataValidationError } from "@/modules/afiliaciones/asociados/Services/AssociateAdminDataService";

export async function PATCH(request: Request, { params }: { params: Promise<{ personId: string }> }) {
  try {
    const actor = await requireApiPermission("update", "associates");
    const personId = Number((await params).personId);
    if (!Number.isInteger(personId) || personId <= 0) {
      return NextResponse.json({ success: false, message: "Asociado inválido." }, { status: 400 });
    }
    const input = adminAssociateDataSchema.parse(await request.json());
    await new AssociateAdminDataService().updateAll(actor.id, personId, input);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ApiAuthorizationError) return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    if (error instanceof z.ZodError) return NextResponse.json({ success: false, message: "Verifica los datos ingresados.", errors: error.flatten().fieldErrors }, { status: 400 });
    if (error instanceof AssociateAdminDataValidationError) return NextResponse.json({ success: false, message: error.message, errors: error.errors }, { status: 400 });
    if (error instanceof AssociateAdminDataError) return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    console.error("[ASSOCIATE_ADMIN_DATA] Error inesperado:", { errorName: error instanceof Error ? error.name : typeof error });
    return NextResponse.json({ success: false, message: "No fue posible actualizar los datos." }, { status: 500 });
  }
}
