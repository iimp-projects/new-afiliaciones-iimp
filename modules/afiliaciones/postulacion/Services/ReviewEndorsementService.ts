import { prisma } from "@/lib/prisma";
import { EndorsementStatus, SecurityEventType } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { ApplicationStatusCalculatorService } from "./ApplicationStatusCalculatorService";
import { MailService } from "@/modules/shared/Services/MailService";
import { getAppBaseUrl } from "@/lib/config/env";
import { verifyEndorsementToken } from "./EndorsementToken";
import { emailLayout } from "@/modules/shared/Email/EmailLayout";
import { emailCta, emailInfoBox } from "@/modules/shared/Email/EmailComponents";
import { escapeHtml } from "@/modules/shared/Email/EmailEscaping";
import { notifyIncorporationPaymentRequest } from "../../payments/Services/IncorporationPaymentRequestEmailService";

interface ReviewEndorsementPayload {
  applicationId: number;
  sponsorPersonId: number;
}

interface ReviewEndorsementOptions {
  ipAddress?: string;
  userAgent?: string;
}

export type ReviewEndorsementAction = "APPROVE" | "REJECT";

const reviewInclude = {
  application: { include: { person: true } },
  sponsorPerson: { include: { contacts: true } },
} as const;

type EndorsementWithRelations = Prisma.MembershipApprovalGetPayload<{
  include: typeof reviewInclude;
}>;

/**
 * Errores de negocio de la revisión de un aval. El flujo por correo los propaga
 * como `Error`; el endpoint del portal los usa para mapear el HTTP status sin
 * filtrar detalles internos.
 */
export type ReviewEndorsementErrorCode = "NOT_FOUND" | "ALREADY_PROCESSED";
export class ReviewEndorsementError extends Error {
  public constructor(
    public readonly code: ReviewEndorsementErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ReviewEndorsementError";
  }
}

export class ReviewEndorsementService {
  private readonly mailService = new MailService();

  /**
   * Revisión desde el enlace enviado por correo. La identidad proviene del
   * token firmado (`applicationId` + `sponsorPersonId`).
   */
  async execute(
    token: string,
    action: ReviewEndorsementAction,
    options?: ReviewEndorsementOptions
  ): Promise<void> {
    let decoded: ReviewEndorsementPayload;

    // 1. Verificar y decodificar el token JWT (issuer/audience/purpose)
    try {
      decoded = verifyEndorsementToken(token);
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "TokenExpiredError") {
        throw new Error("El enlace ha expirado.");
      }
      throw new Error("El enlace es inválido o no posee un formato correcto.");
    }

    const { applicationId, sponsorPersonId } = decoded;

    const endorsement = await prisma.membershipApproval.findFirst({
      where: { applicationId, sponsorPersonId },
      include: reviewInclude,
    });

    await this.applyDecision(endorsement, action, options);
  }

  /**
   * Revisión desde el portal "Mis avales". El aval se localiza por su id y por
   * el `sponsorPersonId` de la persona autenticada, de modo que un asociado sólo
   * puede responder sus propios avales pendientes.
   */
  async reviewOwned(
    approvalId: number,
    sponsorPersonId: number,
    action: ReviewEndorsementAction,
    options?: ReviewEndorsementOptions
  ): Promise<void> {
    const endorsement = await prisma.membershipApproval.findFirst({
      where: { id: approvalId, sponsorPersonId },
      include: reviewInclude,
    });

    await this.applyDecision(endorsement, action, options);
  }

  /** Transición de estado + auditoría + recálculo + notificación por correo. */
  private async applyDecision(
    endorsement: EndorsementWithRelations | null,
    action: ReviewEndorsementAction,
    options?: ReviewEndorsementOptions
  ): Promise<void> {
    if (!endorsement) {
      throw new ReviewEndorsementError(
        "NOT_FOUND",
        "No se encontró el registro de aval correspondiente."
      );
    }

    if (endorsement.status !== EndorsementStatus.PENDING) {
      throw new ReviewEndorsementError(
        "ALREADY_PROCESSED",
        `Esta solicitud de aval ya fue procesada anteriormente con estado: ${endorsement.status}.`
      );
    }

    const { applicationId, sponsorPersonId } = endorsement;
    const newStatus =
      action === "APPROVE"
        ? EndorsementStatus.APPROVED
        : EndorsementStatus.REJECTED;

    // 3. Transacción para actualizar el estado y registrar el respaldo en la BD
    await prisma.$transaction(async (tx) => {
      await tx.membershipApproval.update({
        where: { id: endorsement.id },
        data: {
          status: newStatus,
          transactionDate: new Date(),
        },
      });

      await tx.securityEvent.create({
        data: {
          type: Object.values(SecurityEventType)[0],
          ipAddress: options?.ipAddress || "SYSTEM",
          userAgent: options?.userAgent || "EMAIL_ACTION",
          metadata: {
            action: "ENDORSEMENT_REVIEWED",
            applicationId,
            sponsorPersonId,
            previousStatus: endorsement.status,
            newStatus,
            reviewedAt: new Date().toISOString(),
          },
        },
      });
    });

    // 4. Recalcular el estado global de la solicitud
    const calculator = new ApplicationStatusCalculatorService();
    await calculator.recalculate(applicationId);
    await notifyIncorporationPaymentRequest(applicationId);

    // 5. Construcción de datos para la notificación por correo
    const applicantPerson = endorsement.application.person;
    const sponsorPerson = endorsement.sponsorPerson;

    const applicantEmail = endorsement.application.email;

    const applicantName = applicantPerson
      ? `${applicantPerson.firstName} ${applicantPerson.paternalLastName}`.trim()
      : "Postulante";

    const sponsorName = `${sponsorPerson.firstName} ${sponsorPerson.paternalLastName}`.trim();

    // 6. Enviar notificación por MailService
    if (applicantEmail) {
      const isApproved = action === "APPROVE";
      const statusColor = isApproved ? "#2e7d32" : "#d32f2f";
      const statusBg = isApproved ? "#e8f5e9" : "#ffebee";
      const statusText = isApproved ? "APROBADO" : "RECHAZADO";

      // URL del portal para consultar estado (utiliza la variable de entorno base)
      const baseUrl = getAppBaseUrl();
      const trackingUrl = `${baseUrl}/postulacion/estado`;  //CAMBIAR CUANDO TENGAMOS ENLACE DE CONSULTA DE ESTADO

      // Mensaje y botón dinámicos según el resultado
      const statusMessage = isApproved
        ? "Tu expediente continuará con el proceso de revisión institucional correspondiente."
        : "Para continuar con tu proceso de afiliación, por favor ingresa a consultar tu estado y registra un nuevo aval.";

      const ctaButtonHtml = !isApproved
        ? `
          <div style="text-align: center; margin-top: 25px;">
            <a href="${trackingUrl}" style="background-color: #c59b27; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 700; font-size: 14px; display: inline-block;">
              Actualizar Aval
            </a>
          </div>
        `
        : "";

      const htmlContent = emailLayout({ category: "Estado de Aval", title: "Estado de Aprobación de Aval", summary: `Tu aval ha ${isApproved ? "aprobado" : "rechazado"} tu solicitud.`, variant: isApproved ? "success" : "warning", content: `<p>Estimado(a) <strong>${escapeHtml(applicantName.toUpperCase())}</strong>,</p><p>Te informamos que tu aval <strong>${escapeHtml(sponsorName)}</strong> ha evaluado tu solicitud de incorporación.</p>${emailInfoBox(`<strong>${statusText}</strong><br>${escapeHtml(statusMessage)}`, isApproved ? "success" : "warning")}${!isApproved ? emailCta("ACTUALIZAR AVAL", trackingUrl) : ""}` });
      await this.mailService.sendMail({
        to: applicantEmail,
        subject: `IIMP | Status de aprobación de aval_ ${applicantName}`,
        html: htmlContent,
      });
    }
  }
}
