import { NextResponse } from "next/server";
import { ApiAuthorizationError, requireApiPermission } from "@/modules/auth/context/api-authorization";
import { canManageApplicantNotifications } from "@/modules/afiliaciones/expedientes/Utils/applicantNotificationPermissions";
import { AssociateAccessError, associateAccessService } from "@/modules/afiliaciones/asociados/Services/AssociateAccessService";

export async function POST(_request: Request, { params }: { params: Promise<{ personId: string }> }) {
  try {
    const personId = Number((await params).personId);
    if (!Number.isInteger(personId) || personId <= 0) return NextResponse.json({ success: false, message: "Asociado inválido." }, { status: 400 });
    const user = await requireApiPermission("update", "associates");
    if (!canManageApplicantNotifications(user.role.slug)) return NextResponse.json({ success: false, message: "No autorizado." }, { status: 403 });
    const data = await associateAccessService.retryProvisioningByPerson(personId, user.id);
    return NextResponse.json({ success: true, data, message: "Acceso habilitado. Se envió el correo de activación." });
  } catch (error) {
    if (error instanceof ApiAuthorizationError) return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    if (error instanceof AssociateAccessError) return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    return NextResponse.json({ success: false, message: "No fue posible habilitar el acceso." }, { status: 500 });
  }
}
