import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { EndorsementStatus } from "@prisma/client";
import { NotifySponsorsService } from "@/modules/afiliaciones/postulacion/Services/NotifySponsorsService";
import { apiAuthorizationStatus, requireApiPermission } from "@/modules/auth/context/api-authorization";

export async function POST(req: Request) {
  try {
    const currentUser = await requireApiPermission("update", "memberships");
    const { applicationId, approvalId } = await req.json();

    if (!applicationId || !approvalId) {
      return NextResponse.json({ success: false, error: "Faltan parámetros obligatorios." }, { status: 400 });
    }

    const actorName = `${currentUser.person.firstName} ${currentUser.person.paternalLastName}`;

    // 2. Obtener Aprobación actual
    const approval = await prisma.membershipApproval.findUnique({
      where: { id: Number(approvalId) },
      include: { sponsorPerson: { include: { user: true, contacts: { where: { isPrimary: true }, take: 1 } } } }
    });

    if (!approval || approval.applicationId !== Number(applicationId) || approval.status !== EndorsementStatus.PENDING) {
      return NextResponse.json({ success: false, error: "El aval no existe o ya no está pendiente." }, { status: 400 });
    }

    const application = await prisma.membershipApplication.findUnique({
      where: { id: Number(applicationId) },
      include: { person: true }
    });

    if (!application) return NextResponse.json({ success: false, error: "Solicitud no encontrada." }, { status: 404 });

    // 3. Preparar datos
    const applicantFullName = application.person
      ? `${application.person.firstName || ""} ${application.person.paternalLastName || ""}`.trim()
      : "el postulante";

    const sponsorPerson = approval.sponsorPerson;
    const sponsorFullName = `${sponsorPerson.firstName || ""} ${sponsorPerson.paternalLastName || ""}`.trim();
    const sponsorEmail = sponsorPerson.user?.email || sponsorPerson.contacts[0]?.email;
    if (!sponsorEmail) return NextResponse.json({ success: false, error: "El aval no tiene un correo registrado." }, { status: 400 });

    const draft = typeof (application as any).draftData === 'string'
      ? JSON.parse((application as any).draftData)
      : (application as any).draftData;

    // 4. Enviar el correo FORZANDO a usar el sponsorEmail del frontend
    const notifyService = new NotifySponsorsService();
    await notifyService.sendSingleSponsorNotification({
      applicationId: application.id,
      sponsorPersonId: sponsorPerson.id,
      sponsorEmail,
      sponsorFullName: sponsorFullName,
      applicantName: applicantFullName,
      draft: draft || {}
    });

    // 5. GUARDAR EL HISTORIAL EN EL JSON
    const currentHistory = Array.isArray(approval.resendHistory) ? approval.resendHistory : [];
    const newRecord = {
      date: new Date().toISOString(),
      actor: actorName
    };

    await prisma.membershipApproval.update({
      where: { id: Number(approvalId) },
      data: { resendHistory: [...currentHistory, newRecord] }
    });

    return NextResponse.json({ success: true, message: "Correo reenviado correctamente y registrado en el historial." });

  } catch (error: unknown) {
    console.error("💥 Error reenviando correo al aval:", error);
    const status = apiAuthorizationStatus(error, 500);
    return NextResponse.json({ success: false, error: status < 500 ? "No autorizado." : "Error interno del servidor al reenviar correo." }, { status });
  }
}
