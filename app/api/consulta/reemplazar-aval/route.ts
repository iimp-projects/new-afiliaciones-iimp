import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { EndorsementStatus } from "@prisma/client";
import { ApplicationStatusCalculatorService } from "@/modules/afiliaciones/postulacion/Services/ApplicationStatusCalculatorService";
import { NotifySponsorsService } from "@/modules/afiliaciones/postulacion/Services/NotifySponsorsService";
import { ApplicationDraft } from "@/modules/afiliaciones/postulacion/Models/ApplicationDraft";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("📦 BODY RECIBIDO EN BACKEND:", body);

    const { application_id, sponsor_person_id, sponsor_code } = body;

    if (!application_id || !sponsor_person_id) {
      return NextResponse.json(
        { success: false, error: "Faltan parámetros obligatorios (application_id o sponsor_person_id)." },
        { status: 400 }
      );
    }

    const appId = Number(application_id);
    const sponsorId = Number(sponsor_person_id);

    // 🔍 1. Validar Solicitud
    const application = await prisma.membershipApplication.findUnique({
      where: { id: appId },
      include: { person: true },
    });

    if (!application) {
      return NextResponse.json(
        { success: false, error: `No existe el expediente ID ${appId} en la base de datos.` },
        { status: 404 }
      );
    }

    // 📄 Parsear el borrador/draft guardado en la base de datos
    const applicationDraft = typeof (application as any).draftData === 'string'
      ? JSON.parse((application as any).draftData)
      : (application as any).draftData as ApplicationDraft;

    // 🔍 2. Validar Persona (Nuevo Aval) e incluir su Usuario o Contactos para obtener el Email
    const sponsorPerson = await prisma.person.findUnique({
      where: { id: sponsorId },
      include: {
        user: true,
        contacts: {
          where: { isPrimary: true },
          take: 1,
        },
      },
    });

    if (!sponsorPerson) {
      return NextResponse.json(
        { success: false, error: `El asociado/aval con ID ${sponsorId} no existe en la base de datos.` },
        { status: 404 }
      );
    }

    // 🔍 3. Validar que el nuevo aval no esté registrado activamente
    const existingActiveApproval = await prisma.membershipApproval.findFirst({
      where: {
        applicationId: appId,
        sponsorPersonId: sponsorId,
        status: {
          not: EndorsementStatus.INACTIVE,
        },
      },
    });

    if (existingActiveApproval) {
      return NextResponse.json(
        {
          success: false,
          error: "Este asociado ya figura como un aval registrado/pendiente en esta solicitud.",
        },
        { status: 400 }
      );
    }

    // 🔄 4. Transacción
    const result = await prisma.$transaction(async (tx) => {
      // Desactivar el aval rechazado previamente
      await tx.membershipApproval.updateMany({
        where: {
          applicationId: appId,
          status: EndorsementStatus.REJECTED,
        },
        data: {
          status: EndorsementStatus.INACTIVE,
        },
      });

      // Crear el nuevo registro de aval en PENDING
      const newApproval = await tx.membershipApproval.create({
        data: {
          applicationId: appId,
          sponsorPersonId: sponsorId,
          sponsorCode: sponsor_code || null,
          status: EndorsementStatus.PENDING,
        },
      });

      // Resetear EXCLUSIVAMENTE el área AVALES en las validaciones
      await tx.membershipValidation.updateMany({
        where: { 
          applicationId: appId,
          department: {
            code: "AVALES"
          }
        },
        data: { status: "PENDING" },
      });

      return { newApproval };
    });

    // 🔄 5. Recalcular el estado general de la postulación
    const statusCalculator = new ApplicationStatusCalculatorService();
    const newStatus = await statusCalculator.recalculate(appId);

    // 📧 6. NOTIFICACIONES VÍA CORREO
    const notifyService = new NotifySponsorsService();

    const applicantFullName = application.person
      ? `${application.person.firstName || ""} ${application.person.paternalLastName || ""}`.trim()
      : "el postulante";

    const sponsorFullName = `${sponsorPerson.firstName || ""} ${sponsorPerson.paternalLastName || ""}`.trim();
    const applicantEmail = application.email; 
    const sponsorEmail = sponsorPerson.user?.email || sponsorPerson.contacts[0]?.email;

    // 📄 6.0. ACTUALIZAR EL DRAFT CON EL NUEVO AVAL
    const updatedDraft = JSON.parse(JSON.stringify(applicationDraft || {}));

    const sponsorDni = sponsorPerson.documentNumber || "";

    if (updatedDraft.endorsements) {
      // Detectamos cuál aval fue rechazado (el que estamos reemplazando)
      const isFirstRejected = updatedDraft.endorsements.firstEndorsement?.status === 'REJECTED';
      const targetEndorsementKey = isFirstRejected ? 'firstEndorsement' : 'secondEndorsement';

      updatedDraft.endorsements[targetEndorsementKey] = {
        ...updatedDraft.endorsements[targetEndorsementKey],
        sponsorPersonId: sponsorId,
        sponsorFullName: sponsorFullName,
        sponsorEmail: sponsorEmail,
        sponsorCode: sponsor_code || updatedDraft.endorsements[targetEndorsementKey]?.sponsorCode,
        documentNumber: sponsorDni,
        sponsorDocumentNumber: sponsorDni,
        status: 'PENDING',
      };

      // Guardar el borrador actualizado en la BD para sincronizar el PDF permanentemente
      await prisma.membershipApplication.update({
        where: { id: appId },
        data: { draftData: updatedDraft },
      });
    }

    // 6.1. Correo al NUEVO AVAL (con el draft actualizado)
    if (sponsorEmail) {
      await notifyService.sendSingleSponsorNotification({
        applicationId: appId,
        sponsorPersonId: sponsorId,
        sponsorEmail: sponsorEmail,
        sponsorFullName: sponsorFullName,
        applicantName: applicantFullName,
        draft: updatedDraft, // 👈 Se envía el borrador ya modificado
      });
    } else {
      console.error(`⚠️ No se encontró email de usuario ni contacto para el aval ID ${sponsorId}`);
    }

    // 6.2. Correo de confirmación al POSTULANTE
    if (applicantEmail) {
      await notifyService.sendApplicantReplacementConfirmation({
        applicantEmail: applicantEmail,
        applicantName: applicantFullName,
        newSponsorFullName: sponsorFullName,
        trackingCode: application.trackingCode || application.applicationCode,
      });
    } else {
      console.error(`⚠️ No se encontró email registrado en la solicitud ID ${appId}`);
    }

    return NextResponse.json({
      success: true,
      message: "Aval reemplazado y notificaciones enviadas correctamente.",
      data: { ...result, newStatus },
    });
  } catch (error: any) {
    console.error("💥 ERROR EN REEMPLAZAR AVAL:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Error interno al guardar en BD." },
      { status: 500 }
    );
  }
}