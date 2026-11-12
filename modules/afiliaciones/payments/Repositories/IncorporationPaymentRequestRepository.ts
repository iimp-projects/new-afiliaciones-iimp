import type { AffiliateType, ApplicationStatus, DocumentType, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface IncorporationPaymentRequestPayment {
  status: PaymentStatus;
  registrationAmount: number | null;
  membershipFeeAmount: number | null;
}

export interface IncorporationPaymentRequestCandidate {
  id: number;
  status: ApplicationStatus;
  affiliateType: AffiliateType;
  email: string;
  deletedAt: Date | null;
  documentType: DocumentType;
  documentNumber: string;
  person: {
    firstName: string;
    paternalLastName: string;
    maternalLastName: string | null;
  } | null;
  payments: IncorporationPaymentRequestPayment[];
}

/**
 * Lectura mínima para decidir y renderizar la solicitud de pago de
 * incorporación. No modifica estados ni pagos.
 */
export class IncorporationPaymentRequestRepository {
  async findCandidate(applicationId: number): Promise<IncorporationPaymentRequestCandidate | null> {
    const application = await prisma.membershipApplication.findUnique({
      where: { id: applicationId },
      select: {
        id: true,
        status: true,
        affiliateType: true,
        email: true,
        deletedAt: true,
        documentType: true,
        documentNumber: true,
        person: {
          select: { firstName: true, paternalLastName: true, maternalLastName: true },
        },
        payments: {
          orderBy: { createdAt: "desc" },
          select: { status: true, registrationAmount: true, membershipFeeAmount: true },
        },
      },
    });

    if (!application) return null;

    return {
      ...application,
      payments: application.payments.map((payment) => ({
        status: payment.status,
        registrationAmount: payment.registrationAmount?.toNumber() ?? null,
        membershipFeeAmount: payment.membershipFeeAmount?.toNumber() ?? null,
      })),
    };
  }
}
