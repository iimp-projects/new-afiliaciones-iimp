import { NextRequest, NextResponse } from "next/server";
import { apiAuthorizationStatus, requireApiPermission } from "@/modules/auth/context/api-authorization";
import {
  IncorporationPaymentRequestEmailService,
  type IncorporationPaymentRequestSendResult,
} from "@/modules/afiliaciones/payments/Services/IncorporationPaymentRequestEmailService";

function responseFor(reason: IncorporationPaymentRequestSendResult["reason"]): { status: number; error: string } {
  switch (reason) {
    case "NOT_FOUND":
    case "DELETED":
      return { status: 404, error: "El expediente no existe o no está disponible." };
    case "NOT_READY_FOR_PAYMENT":
      return { status: 409, error: "El expediente no se encuentra en estado Apto para Pago." };
    case "STUDENT_EXEMPT":
      return { status: 422, error: "La modalidad Estudiante no está sujeta a estos conceptos de pago." };
    case "INVALID_EMAIL":
      return { status: 422, error: "El postulante no tiene un correo electrónico válido registrado." };
    case "ALREADY_PAID":
    case "NOTHING_TO_CHARGE":
      return { status: 409, error: "Los conceptos de pago ya se encuentran cubiertos por un pago validado." };
    case "AMOUNTS_UNAVAILABLE":
      return { status: 503, error: "No existen importes vigentes configurados para el pago de incorporación." };
    case "ASSETS_UNAVAILABLE":
      return { status: 503, error: "No se pudieron cargar los recursos institucionales del correo." };
    case "DUPLICATE":
      return { status: 409, error: "El correo ya fue enviado o se encuentra en proceso." };
    case "SEND_FAILED":
      return { status: 502, error: "No se pudo enviar el correo. Intente nuevamente." };
    default:
      return { status: 500, error: "No se pudo procesar el envío del correo." };
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireApiPermission("update", "memberships");
    const { id } = await params;
    const applicationId = Number(id);
    if (!Number.isInteger(applicationId) || applicationId < 1) {
      return NextResponse.json({ success: false, error: "Expediente inválido." }, { status: 400 });
    }

    const result = await new IncorporationPaymentRequestEmailService().sendManual(applicationId);
    if (result.sent) {
      return NextResponse.json(
        { success: true, message: "Correo con los métodos de pago enviado correctamente." },
        { status: 200 },
      );
    }

    const mapped = responseFor(result.reason);
    return NextResponse.json({ success: false, error: mapped.error }, { status: mapped.status });
  } catch (error: unknown) {
    const status = apiAuthorizationStatus(error, 500);
    return NextResponse.json(
      { success: false, error: status < 500 ? "No autorizado." : "No se pudo enviar el correo." },
      { status },
    );
  }
}
