import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiAuthorizationError, requireApiPermission } from "@/modules/auth/context/api-authorization";
import { canManageApplicantNotifications } from "@/modules/afiliaciones/expedientes/Utils/applicantNotificationPermissions";
import { adminAssociateDataSchema } from "@/modules/afiliaciones/asociados/Validators/AdminAssociateDataSchema";
import { AssociateAdminDataError, AssociateAdminDataValidationError, AssociateAdminDataService } from "@/modules/afiliaciones/asociados/Services/AssociateAdminDataService";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const applicationId = Number((await params).id);
    if (!Number.isInteger(applicationId) || applicationId <= 0) {
      return NextResponse.json({ success: false, message: "Expediente inválido." }, { status: 400 });
    }
    const user = await requireApiPermission("update", "applications");
    if (!canManageApplicantNotifications(user.role.slug)) {
      return NextResponse.json({ success: false, message: "No autorizado." }, { status: 403 });
    }
    const application = await prisma.membershipApplication.findFirst({
      where: { id: applicationId, deletedAt: null },
      select: { personId: true },
    });
    if (!application?.personId) {
      return NextResponse.json({ success: false, message: "El expediente no tiene una persona asociada." }, { status: 404 });
    }
    const input = adminAssociateDataSchema.parse(await request.json());
    await new AssociateAdminDataService().updateAll(user.id, application.personId, input, { applicationId });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ApiAuthorizationError) return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    if (error instanceof z.ZodError) return NextResponse.json({ success: false, message: "Verifica los datos ingresados.", errors: error.flatten().fieldErrors }, { status: 400 });
    if (error instanceof AssociateAdminDataValidationError) return NextResponse.json({ success: false, message: error.message, errors: error.errors }, { status: 400 });
    if (error instanceof AssociateAdminDataError) return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    console.error("[EXPEDIENTE_ADMIN_DATA] Error inesperado:", { errorName: error instanceof Error ? error.name : typeof error });
    return NextResponse.json({ success: false, message: "No fue posible actualizar los datos del postulante." }, { status: 500 });
  }
}
