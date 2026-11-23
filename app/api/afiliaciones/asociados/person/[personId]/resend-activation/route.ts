import { NextResponse } from "next/server";
import { UserStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiAuthorizationError, requireApiPermission } from "@/modules/auth/context/api-authorization";
import { canManageApplicantNotifications } from "@/modules/afiliaciones/expedientes/Utils/applicantNotificationPermissions";
import { accountActivationService } from "@/modules/auth/account-activation/service";

export async function POST(_request: Request, { params }: { params: Promise<{ personId: string }> }) {
  try {
    const personId = Number((await params).personId);
    if (!Number.isInteger(personId) || personId <= 0) return NextResponse.json({ success: false, message: "Asociado inválido." }, { status: 400 });
    const user = await requireApiPermission("update", "associates");
    if (!canManageApplicantNotifications(user.role.slug)) return NextResponse.json({ success: false, message: "No autorizado." }, { status: 403 });

    const account = await prisma.user.findFirst({ where: { personId, deletedAt: null }, select: { id: true, status: true } });
    if (!account) return NextResponse.json({ success: false, message: "La persona no tiene una cuenta de acceso." }, { status: 404 });
    if (account.status !== UserStatus.PENDING) return NextResponse.json({ success: false, message: "La cuenta no está pendiente de activación." }, { status: 409 });

    await accountActivationService.createAndSendActivation(account.id);
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "ACTIVATION_RESEND",
        entity: "User",
        entityId: String(account.id),
        newValues: { personId, userId: account.id },
      },
    });
    return NextResponse.json({ success: true, message: "Correo de activación reenviado." });
  } catch (error) {
    if (error instanceof ApiAuthorizationError) return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    console.error("[RESEND_ACTIVATION] Error inesperado:", { errorName: error instanceof Error ? error.name : typeof error });
    return NextResponse.json({ success: false, message: "No fue posible reenviar la activación." }, { status: 500 });
  }
}
