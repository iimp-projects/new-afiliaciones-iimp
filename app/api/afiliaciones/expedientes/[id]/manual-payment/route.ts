import { NextResponse } from "next/server";
import { PaymentMethod } from "@prisma/client";
import { ApiAuthorizationError, requireApiPermission } from "@/modules/auth/context/api-authorization";
import { canManageApplicantNotifications } from "@/modules/afiliaciones/expedientes/Utils/applicantNotificationPermissions";
import { ManualPaymentError, ManualPaymentRegistrationService } from "@/modules/afiliaciones/payments/Services/ManualPaymentRegistrationService";

function parseApplicationId(value: string): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

const METHODS = Object.values(PaymentMethod) as string[];

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const applicationId = parseApplicationId((await params).id);
    if (!applicationId) return NextResponse.json({ success: false, message: "Expediente inválido." }, { status: 400 });
    const user = await requireApiPermission("read", "applications");
    if (!canManageApplicantNotifications(user.role.slug)) {
      return NextResponse.json({ success: false, message: "No autorizado." }, { status: 403 });
    }
    const data = await new ManualPaymentRegistrationService().getEligibility(applicationId);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof ApiAuthorizationError) return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    if (error instanceof ManualPaymentError) return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    return NextResponse.json({ success: false, message: "No fue posible consultar el expediente." }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const applicationId = parseApplicationId((await params).id);
    if (!applicationId) return NextResponse.json({ success: false, message: "Expediente inválido." }, { status: 400 });
    const user = await requireApiPermission("approve", "applications");
    if (!canManageApplicantNotifications(user.role.slug)) {
      return NextResponse.json({ success: false, message: "No autorizado." }, { status: 403 });
    }

    const form = await request.formData();
    const method = String(form.get("method") ?? "");
    const reference = String(form.get("reference") ?? "").trim();
    const comment = String(form.get("comment") ?? "").trim();
    const paidAt = String(form.get("paidAt") ?? "");
    const proof = form.get("proof");
    if (!METHODS.includes(method)) return NextResponse.json({ success: false, message: "Seleccione el medio de pago." }, { status: 400 });
    if (!(proof instanceof File) || proof.size === 0) return NextResponse.json({ success: false, message: "Adjunte el comprobante de pago." }, { status: 400 });
    const paidDate = new Date(`${paidAt}T12:00:00.000Z`);
    if (!paidAt || Number.isNaN(paidDate.getTime())) return NextResponse.json({ success: false, message: "Ingrese una fecha de pago válida." }, { status: 400 });

    const data = await new ManualPaymentRegistrationService().register({
      applicationId,
      actorUserId: user.id,
      method: method as PaymentMethod,
      reference,
      comment: comment || null,
      paidAt: paidDate,
      proof: {
        buffer: Buffer.from(await proof.arrayBuffer()),
        fileName: proof.name,
        mimeType: proof.type,
        sizeBytes: proof.size,
      },
      ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined,
      userAgent: request.headers.get("user-agent") || undefined,
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof ApiAuthorizationError) return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    if (error instanceof ManualPaymentError) return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    console.error("[MANUAL_PAYMENT] Error inesperado:", { errorName: error instanceof Error ? error.name : typeof error });
    return NextResponse.json({ success: false, message: "No fue posible registrar el pago manual." }, { status: 500 });
  }
}
