import { NextRequest, NextResponse } from "next/server";
import { canManageApplicantNotifications } from "@/modules/afiliaciones/expedientes/Utils/applicantNotificationPermissions";
import { IncorporationPaymentRequestEmailService } from "@/modules/afiliaciones/payments/Services/IncorporationPaymentRequestEmailService";
import { apiAuthorizationStatus, requireApiPermission } from "@/modules/auth/context/api-authorization";

export const runtime = "nodejs";

const REASON_RESPONSE: Readonly<Record<string, { status: number; message: string }>> = {
  NOT_FOUND: { status: 404, message: "Solicitud no encontrada." },
  DELETED: { status: 409, message: "La solicitud no está disponible." },
  NOT_READY_FOR_PAYMENT: { status: 409, message: "El expediente aún no está apto para pago." },
  STUDENT_EXEMPT: { status: 409, message: "La modalidad Estudiante es gratuita." },
  INVALID_EMAIL: { status: 422, message: "El postulante no tiene un correo válido registrado." },
  ALREADY_PAID: { status: 409, message: "El postulante ya registra los pagos correspondientes." },
  AMOUNTS_UNAVAILABLE: { status: 503, message: "No se pudieron obtener los importes vigentes." },
  ASSETS_UNAVAILABLE: { status: 503, message: "No se pudieron preparar los recursos del correo." },
  NOTHING_TO_CHARGE: { status: 409, message: "No hay conceptos pendientes de pago." },
  DUPLICATE: { status: 409, message: "El correo ya fue enviado recientemente." },
  SEND_FAILED: { status: 502, message: "No se pudo enviar el correo con los métodos de pago manual." },
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

    const result = await new IncorporationPaymentRequestEmailService().sendIfEligible(
      applicationId,
      { forceResend: true, mode: "MANUAL_PAYMENT_METHODS" },
    );
    if (!result.sent) {
      const mapped = result.reason ? REASON_RESPONSE[result.reason] : undefined;
      return NextResponse.json(
        { success: false, code: result.reason ?? "UNKNOWN", error: mapped?.message ?? "No se pudo enviar el correo." },
        { status: mapped?.status ?? 409 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Se envió el correo de métodos de pago manual al postulante.",
    });
  } catch (error: unknown) {
    console.error("[SendPaymentMethods Error]:", error);
    const status = apiAuthorizationStatus(error, 500);
    return NextResponse.json(
      { success: false, error: status < 500 ? "No autorizado." : "No se pudo enviar el correo de métodos de pago manual." },
      { status },
    );
  }
}
