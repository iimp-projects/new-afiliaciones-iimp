import { NextResponse } from "next/server";
import { ApiAuthorizationError, requireApiPermission } from "@/modules/auth/context/api-authorization";
import { canManageApplicantNotifications } from "@/modules/afiliaciones/expedientes/Utils/applicantNotificationPermissions";
import { AdminPasswordResetError, AdminPasswordResetService } from "@/modules/afiliaciones/asociados/Services/AdminPasswordResetService";

export async function POST(_request: Request, { params }: { params: Promise<{ personId: string }> }) {
  try {
    const personId = Number((await params).personId);
    if (!Number.isInteger(personId) || personId <= 0) return NextResponse.json({ success: false, message: "Asociado inválido." }, { status: 400 });
    const user = await requireApiPermission("update", "associates");
    if (!canManageApplicantNotifications(user.role.slug)) return NextResponse.json({ success: false, message: "No autorizado." }, { status: 403 });
    const data = await new AdminPasswordResetService().resetToDocument(personId, user.id);
    return NextResponse.json({ success: true, data, message: "Contraseña restablecida con su número de documento. Deberá cambiarla al iniciar sesión." });
  } catch (error) {
    if (error instanceof ApiAuthorizationError) return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    if (error instanceof AdminPasswordResetError) return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    console.error("[ADMIN_PASSWORD_RESET] Error inesperado:", { errorName: error instanceof Error ? error.name : typeof error });
    return NextResponse.json({ success: false, message: "No fue posible restablecer la contraseña." }, { status: 500 });
  }
}
