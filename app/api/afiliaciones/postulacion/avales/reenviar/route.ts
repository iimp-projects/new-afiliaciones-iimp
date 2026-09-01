import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { EndorsementStatus } from "@prisma/client";
import { NotifySponsorsService } from "@/modules/afiliaciones/postulacion/Services/NotifySponsorsService";
import { contextService } from "@/modules/auth/context/service"; 

export async function POST(req: Request) {
  try {
    // SOLUCIÓN: Recibimos el correo explícitamente desde el Frontend
    const { applicationId, approvalId, sponsorEmail } = await req.json();

    if (!applicationId || !approvalId || !sponsorEmail) {
      return NextResponse.json({ success: false, error: "Faltan parámetros obligatorios." }, { status: 400 });
    }

    if (sponsorEmail === "No registrado") {
      return NextResponse.json({ success: false, error: "El aval no tiene un correo válido registrado." }, { status: 400 });
    }

    // 1. Identificar al administrador
    const currentUser = await contextService.getCurrentUser().catch(() => null);
    const actorName = currentUser 
      ? `${currentUser.person.firstName} ${currentUser.person.paternalLastName}` 
      : "Sistema";

    // 2. Obtener Aprobación actual
    const approval = await prisma.membershipApproval.findUnique({
      where: { id: Number(approvalId) },
      include: { sponsorPerson: true }
    });

    if (!approval || approval.status !== EndorsementStatus.PENDING) {
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

    const draft = typeof (application as any).draftData === 'string'
      ? JSON.parse((application as any).draftData)
      : (application as any).draftData;

    // 4. Enviar el correo FORZANDO a usar el sponsorEmail del frontend
    const notifyService = new NotifySponsorsService();
    await notifyService.sendSingleSponsorNotification({
      applicationId: application.id,
      sponsorPersonId: sponsorPerson.id,
      sponsorEmail: sponsorEmail, // <--- Este es el correo 100% exacto que ves en la pantalla
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

  } catch (error: any) {
    console.error("💥 Error reenviando correo al aval:", error);
    return NextResponse.json({ success: false, error: "Error interno del servidor al reenviar correo." }, { status: 500 });
  }
}