import { NextRequest, NextResponse } from "next/server";
import { canManageApplicantNotifications } from "@/modules/afiliaciones/expedientes/Utils/applicantNotificationPermissions";
import { NotifyApplicantService } from "@/modules/afiliaciones/postulacion/Services/NotifyApplicantService";
import { apiAuthorizationStatus, requireApiPermission } from "@/modules/auth/context/api-authorization";

export const runtime = "nodejs";

const REASON_RESPONSE: Readonly<Record<string, { status: number; message: string }>> = {
  NOT_FOUND: { status: 404, message: "Solicitud no encontrada." },
  NO_EMAIL: { status: 422, message: "El postulante no tiene un correo válido registrado." },
  SEND_FAILED: { status: 502, message: "No se pudo reenviar el correo al postulante." },
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const currentUser = await requireApiPermission("update", "applications");
    if (!canManageApplicantNotifications(currentUser.role.slug)) {
      return NextResponse.json({ success: false, error: "No autorizado." }, { status: 403 });
    }

    const { id } = await params;
    const applicationId = Number(id);
    if (!Number.isSafeInteger(applicationId) || applicationId < 1) {
      return NextResponse.json({ success: false, error: "Expediente inválido." }, { status: 400 });
    }

    const result = await new NotifyApplicantService().resendConfirmation(applicationId);
    if (!result.sent) {
      const mapped = result.reason ? REASON_RESPONSE[result.reason] : undefined;
      return NextResponse.json(
        { success: false, code: result.reason ?? "UNKNOWN", error: mapped?.message ?? "No se pudo reenviar el correo." },
        { status: mapped?.status ?? 409 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Se reenvió la confirmación al postulante.",
    });
  } catch (error: unknown) {
    console.error("[ResendApplicant Error]:", error);
    const status = apiAuthorizationStatus(error, 500);
    return NextResponse.json(
      { success: false, error: status < 500 ? "No autorizado." : "No se pudo reenviar el correo al postulante." },
      { status },
    );
  }
}
