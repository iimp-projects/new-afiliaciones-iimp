import { NextResponse } from "next/server";
import { PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiAuthorizationError, requireApiPermission } from "@/modules/auth/context/api-authorization";
import { canManageApplicantNotifications } from "@/modules/afiliaciones/expedientes/Utils/applicantNotificationPermissions";
import { PaymentRepository } from "@/modules/afiliaciones/payments/Repositories/PaymentRepository";
import { PaymentConfirmationEmailService } from "@/modules/afiliaciones/payments/Services/PaymentConfirmationEmailService";

export async function POST(_request: Request, { params }: { params: Promise<{ personId: string }> }) {
  try {
    const personId = Number((await params).personId);
    if (!Number.isInteger(personId) || personId <= 0) return NextResponse.json({ success: false, message: "Asociado inválido." }, { status: 400 });
    const user = await requireApiPermission("update", "associates");
    if (!canManageApplicantNotifications(user.role.slug)) return NextResponse.json({ success: false, message: "No autorizado." }, { status: 403 });

    const payment = await prisma.payment.findFirst({
      where: { status: PaymentStatus.PAID, application: { personId, deletedAt: null } },
      orderBy: { paymentDate: "desc" },
      select: { id: true },
    });
    if (!payment) return NextResponse.json({ success: false, message: "No hay un pago aprobado para reenviar la confirmación." }, { status: 404 });

    await new PaymentConfirmationEmailService(new PaymentRepository()).resend(payment.id);
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "PAYMENT_CONFIRMATION_RESENT",
        entity: "Payment",
        entityId: String(payment.id),
        newValues: { personId, paymentId: payment.id },
      },
    });
    return NextResponse.json({ success: true, message: "Correo de confirmación de pago reenviado." });
  } catch (error) {
    if (error instanceof ApiAuthorizationError) return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    console.error("[RESEND_PAYMENT_CONFIRMATION] Error inesperado:", { errorName: error instanceof Error ? error.name : typeof error });
    return NextResponse.json({ success: false, message: "No fue posible reenviar la confirmación de pago." }, { status: 500 });
  }
}
