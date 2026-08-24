import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ValidateSponsorService } from "@/modules/afiliaciones/postulacion/Services/ValidateSponsorService";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const documentNumber = searchParams.get("documentNumber")?.trim();
    const applicationIdParam = searchParams.get("applicationId");
    const applicationId = applicationIdParam ? Number(applicationIdParam) : null;

    if (!documentNumber) {
      return NextResponse.json(
        { success: false, message: "El DNI es requerido." },
        { status: 400 }
      );
    }

    // 🔍 1. Validar si ya está registrado en la solicitud actual
    if (applicationId && !isNaN(applicationId)) {
      const existingApproval = await prisma.membershipApproval.findFirst({
        where: {
          applicationId: applicationId,
          sponsorPerson: {
            documentNumber: documentNumber,
          },
          status: {
            not: "INACTIVE",
          },
        },
      });

      if (existingApproval) {
        return NextResponse.json(
          {
            success: false,
            message: "Este asociado ya figura como un aval registrado en esta solicitud.",
          },
          { status: 400 }
        );
      }
    }

    // 🔍 2. Consultar el servicio para obtener al asociado hábil
    const service = new ValidateSponsorService();
    const sponsor: any = await service.execute(documentNumber);

    if (!sponsor) {
      return NextResponse.json(
        { success: false, message: "El DNI no pertenece a un Asociado Activo hábil." },
        { status: 404 }
      );
    }

    const fullName = `${sponsor.firstName || sponsor.names || ""} ${sponsor.paternalLastName || sponsor.fatherLastName || ""} ${sponsor.maternalLastName || sponsor.motherLastName || ""}`.trim();

    return NextResponse.json(
      {
        success: true,
        id: sponsor.id || sponsor.personId,
        fullName: fullName || sponsor.fullName,
        email: sponsor.email,
        sponsorCode: sponsor.code || sponsor.sponsorCode || sponsor.iimpCode,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[ValidateSponsor Route GET] Error:", error);
    return NextResponse.json(
      { success: false, message: "Error interno al validar el aval." },
      { status: 500 }
    );
  }
}

// Mantener POST para compatibilidad con otros formularios
export async function POST(request: NextRequest) {
  try {
    const { documentNumber, applicationId } = await request.json();

    if (!documentNumber) {
      return NextResponse.json({ success: false, message: "El DNI es requerido." }, { status: 400 });
    }

    if (applicationId) {
      const existingApproval = await prisma.membershipApproval.findFirst({
        where: {
          applicationId: Number(applicationId),
          sponsorPerson: {
            documentNumber: documentNumber,
          },
          status: {
            not: "INACTIVE",
          },
        },
      });

      if (existingApproval) {
        return NextResponse.json(
          {
            success: false,
            message: "Este asociado ya figura como un aval registrado en esta solicitud.",
          },
          { status: 400 }
        );
      }
    }

    const service = new ValidateSponsorService();
    const sponsor = await service.execute(documentNumber);

    if (!sponsor) {
      return NextResponse.json({
        success: false,
        message: "El DNI no pertenece a un Asociado Activo hábil.",
      }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: sponsor }, { status: 200 });
  } catch (error: any) {
    console.error("[ValidateSponsor Route POST] Error:", error);
    return NextResponse.json({ success: false, message: "Error interno al validar el aval." }, { status: 500 });
  }
}