import { NextResponse } from "next/server";
import { ApiAuthorizationError, requireApiPermission } from "@/modules/auth/context/api-authorization";
import { canManageApplicantNotifications } from "@/modules/afiliaciones/expedientes/Utils/applicantNotificationPermissions";
import { associateAccessService } from "@/modules/afiliaciones/asociados/Services/AssociateAccessService";

export async function GET(_request: Request, { params }: { params: Promise<{ personId: string }> }) {
  try {
    const personId = Number((await params).personId);
    if (!Number.isInteger(personId) || personId <= 0) return NextResponse.json({ success: false, message: "Asociado inválido." }, { status: 400 });
    const user = await requireApiPermission("read", "associates");
    if (!canManageApplicantNotifications(user.role.slug)) return NextResponse.json({ success: false, message: "No autorizado." }, { status: 403 });
    return NextResponse.json({ success: true, data: await associateAccessService.resolveByPerson(personId) });
  } catch (error) {
    if (error instanceof ApiAuthorizationError) return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    return NextResponse.json({ success: false, message: "No fue posible consultar el acceso." }, { status: 500 });
  }
}
