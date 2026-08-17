import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { EndorsementStatus } from "@prisma/client";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const documentNumber = searchParams.get("documentNumber")?.trim();
    const code = searchParams.get("code")?.trim();

    if (!documentNumber || !code) {
      return NextResponse.json(
        { error: "Faltan parámetros requeridos (DNI o Código)" },
        { status: 400 }
      );
    }

    const application = await prisma.membershipApplication.findFirst({
      where: {
        trackingCode: code,
        person: {
          documentNumber: documentNumber,
        },
      },
      include: {
        person: true,
        approvals: {
          include: {
            sponsorPerson: true,
          },
        },
        validations: {
          include: {
            department: true,
          },
        },
      },
    });

    if (!application) {
      return NextResponse.json(
        { error: `No se encontró ninguna solicitud para el DNI ${documentNumber} y código de seguimiento ${code}.` },
        { status: 404 }
      );
    }

    const person = application.person as any;
    const fullName = person
      ? `${person.firstName || person.names || ""} ${person.paternalLastName || person.fatherLastName || ""} ${person.maternalLastName || person.motherLastName || ""}`.replace(/\s+/g, " ").trim()
      : "Postulante";

    // 🔍 Filtrar avales descartando los INACTIVE
    const approvalsList = application.approvals || [];
    const activeApprovals = approvalsList.filter((s) => (s.status as string) !== "INACTIVE");
    
    const rejectedSponsors = activeApprovals.filter((s) => s.status === EndorsementStatus.REJECTED);
    const approvedSponsors = activeApprovals.filter((s) => s.status === EndorsementStatus.APPROVED);

    // Extraer DNIs activos para evitar duplicados
    const existingSponsorDnis = activeApprovals
      .map((s) => s.sponsorPerson?.documentNumber)
      .filter(Boolean);

    // Determinación del estado exacto del área de Avales
    const isSponsorObserved = rejectedSponsors.length > 0;
    const isSponsorApproved = approvedSponsors.length >= 2;
    
    let sponsorAreaStatus = "PENDING";
    if (isSponsorObserved) {
      sponsorAreaStatus = "OBSERVED";
    } else if (isSponsorApproved) {
      sponsorAreaStatus = "APPROVED";
    }

    // Mapeo dinámico del resto de áreas internas mediante 'validations'
    const getValidationStatus = (deptCode: string) => {
      const validation = application.validations.find(
        (v) => v.department?.code?.toUpperCase() === deptCode.toUpperCase()
      );
      return validation ? validation.status : "PENDING";
    };

    const effectiveStatus = isSponsorObserved ? "OBSERVED" : application.status;

    // Recopilar lista centralizada de observaciones
    const observationsList: string[] = [];
    if (isSponsorObserved) {
      observationsList.push("Un aval ha rechazado la solicitud. Es necesario ingresar los datos de un nuevo aval para continuar.");
    }

    // Agregar observaciones registradas en las áreas internas
    application.validations.forEach((val) => {
      if (val.status === "OBSERVED" && val.department) {
        observationsList.push(`Observación en área (${val.department.name}): Verifique la documentación entregada.`);
      }
    });

    if ((application as any).rejectionReason) {
      observationsList.push((application as any).rejectionReason);
    }

    return NextResponse.json({
      id: application.id,
      applicationId: application.id,
      personId: application.personId,
      status: effectiveStatus,
      applicationCode: application.applicationCode || application.trackingCode,
      trackingCode: application.trackingCode,
      applicantName: fullName,
      existingSponsorDnis: existingSponsorDnis,
      observations: observationsList,
      rejectionReason: (application as any).rejectionReason || null,
      areas: {
        sponsors: {
          status: sponsorAreaStatus,
          approvedCount: approvedSponsors.length,
          requiredCount: 2,
          observation: isSponsorObserved ? "Un aval rechazó la solicitud." : undefined,
        },
        associates: { status: getValidationStatus("ASOCIADOS") },
        logistics: { status: getValidationStatus("LOGISTICA") },
        board: { status: getValidationStatus("DIRECTIVA") },
        payment: { status: getValidationStatus("PAGOS") },
      },
    });
  } catch (error: any) {
    console.error("💥 Error al consultar la solicitud:", error);
    return NextResponse.json(
      { error: error.message || "Error interno al consultar la solicitud" },
      { status: 500 }
    );
  }
}