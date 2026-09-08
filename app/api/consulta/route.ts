import { NextRequest, NextResponse } from "next/server";
import { QUERY_COOKIE, queryAuthorization } from "@/modules/afiliaciones/consulta/Services/QueryAuthorizationService";
import { ApplicationAccessService } from "@/modules/afiliaciones/postulacion/Services/ApplicationAccessService";
import { prisma } from "@/lib/prisma";
import { EndorsementStatus } from "@prisma/client";
import { paymentAuthorizationService } from "@/modules/afiliaciones/payments/Services/PaymentAuthorizationService";
import { paymentConfig } from "@/modules/afiliaciones/payments/Config/PaymentConfig";

export async function GET(request: NextRequest) {
  try {
    // trackingCode identifies an application; it never verifies identity.
    const token = request.cookies.get(QUERY_COOKIE)?.value;
    const allowed = queryAuthorization.allowedIds(token);
    const requestedId = request.nextUrl.searchParams.get("applicationId");
    const applicationId = requestedId ? Number(requestedId) : allowed[0];
    if (!applicationId || !allowed.includes(applicationId)) {
      return NextResponse.json(
        { error: "Verifica tu identidad para consultar la postulación." },
        { status: 401 }
      );
    }

    const application = await prisma.membershipApplication.findFirst({
      where: {
        id: applicationId,
        deletedAt: null,
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
        observations: {
          where: { status: "PENDING" },
          orderBy: { createdAt: "desc" },
        },
        payments: {
          where: { status: "PAID" },
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { billing: { include: { invoice: true } } },
        },
      },
    });

    if (!application) {
      return NextResponse.json(
        { error: "No se encontró la postulación." },
        { status: 404 }
      );
    }

    const summary = (await new ApplicationAccessService().list(token)).find(item => item.id === application.id);
    if (application.status === "DRAFT") {
      return NextResponse.json({ ...summary, applicationId: application.id, applicationCode: application.applicationCode, areas: {} }, { headers: { "Cache-Control": "no-store" } });
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

    const effectiveStatus = application.status;

    // Recopilar lista centralizada de observaciones
    const observationsList: string[] = [];
    if (isSponsorObserved) {
      observationsList.push("Un aval ha rechazado la solicitud. Es necesario ingresar los datos de un nuevo aval para continuar.");
    }

    // Agregar observaciones registradas por el revisor, con sus campos editables.
    const pendingObservations = application.observations.map((observation) => ({
      id: observation.id,
      department: observation.reviewDepartment,
      message: observation.errorDescription,
      fieldPaths: Array.isArray(observation.fieldPaths) ? observation.fieldPaths.filter((path): path is string => typeof path === "string") : [],
    }));
    pendingObservations.forEach((observation) => observationsList.push(observation.message));

    // Mantener el mensaje genérico por área cuando no exista una observación detallada.
    application.validations.forEach((val) => {
      if (val.status === "OBSERVED" && val.department && !pendingObservations.some((observation) => observation.department === val.department.code)) {
        observationsList.push(`Observación en área (${val.department.name}): Verifique la documentación entregada.`);
      }
    });

    if ((application as any).rejectionReason) {
      observationsList.push((application as any).rejectionReason);
    }

    const response = NextResponse.json({
      canStartNew: summary?.canStartNew ?? false,
      recoveryUrl: null,
      id: application.id,
      applicationId: application.id,
      personId: application.personId,
      status: effectiveStatus,
      applicationCode: application.applicationCode || application.trackingCode,
      trackingCode: application.trackingCode,
      documentType: application.documentType,
      documentNumber: application.documentNumber,
      email: application.email,
      phone: application.phone,
      submissionDate: (application.submittedAt ?? application.createdAt).toISOString(),
      draftData: application.draftData,
      pendingObservations,
      applicantName: fullName,
      affiliateType: application.affiliateType,
      completedPayment: application.payments[0] ? {
        id: application.payments[0].id,
        status: application.payments[0].status,
        amount: Number(application.payments[0].totalAmount),
        currency: application.payments[0].currency,
        gateway: application.payments[0].gateway,
        transactionId: application.payments[0].transactionId,
        authorizationCode: application.payments[0].authorizationCode,
        paymentDate: application.payments[0].paymentDate,
        gatewayTransactionDate: application.payments[0].gatewayTransactionDate,
        cardBrand: application.payments[0].cardBrand,
        maskedCard: application.payments[0].maskedCard,
        cardType: application.payments[0].cardType,
        paymentChannel: application.payments[0].paymentChannel,
        traceNumber: application.payments[0].traceNumber,
        billing: application.payments[0].billing ? {
          taxId: application.payments[0].billing.taxId,
          businessName: application.payments[0].billing.businessName,
          billingAddress: application.payments[0].billing.billingAddress,
          invoice: application.payments[0].billing.invoice ? {
            type: application.payments[0].billing.invoice.type,
            serie: application.payments[0].billing.invoice.serie,
            number: application.payments[0].billing.invoice.number,
            issueDate: application.payments[0].billing.invoice.issueDate,
            pdfUrl: application.payments[0].billing.invoice.pdfUrl,
            xmlUrl: application.payments[0].billing.invoice.xmlUrl,
            sunatCdrUrl: application.payments[0].billing.invoice.sunatCdrUrl,
          } : null,
        } : null,
      } : null,
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

    if (effectiveStatus === "READY_FOR_PAYMENT" && !application.deletedAt) {
      response.cookies.set(paymentAuthorizationService.cookieName, paymentAuthorizationService.create(application.id, paymentConfig.authorizationTtlSeconds), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/api/payments",
        maxAge: paymentConfig.authorizationTtlSeconds,
      });
    }

    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    return NextResponse.json(
      { error: "Error interno al consultar la solicitud" },
      { status: 500 }
    );
  }
}
