import { prisma } from "@/lib/prisma";
import {
  SecurityEventType,
  ValidationAction,
  ValidationStatus,
} from "@prisma/client";
import { ApplicationStatusCalculatorService } from "@/modules/afiliaciones/postulacion/Services/ApplicationStatusCalculatorService";
import { AssociatesIntegrationService } from "@/modules/afiliaciones/associates-integration/Services/AssociatesIntegrationService";
import { processPreparedStudentIntegrationAfterCommit } from "@/modules/afiliaciones/expedientes/Services/AdministrativeStatusPostCommitService";
import { AssociateProvisioningService } from "@/modules/afiliaciones/asociados/Services/AssociateProvisioningService";
import { notifyIncorporationPaymentRequest } from "@/modules/afiliaciones/payments/Services/IncorporationPaymentRequestEmailService";
import { verifyComiteReviewToken } from "./ComiteReviewToken";

export type ReviewComiteAction = "APPROVE" | "REJECT";

export type ReviewComiteErrorCode = "NOT_FOUND" | "ALREADY_PROCESSED" | "FORBIDDEN" | "INVALID_COMMENT";

export class ReviewComiteError extends Error {
  public constructor(
    public readonly code: ReviewComiteErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ReviewComiteError";
  }
}

interface ReviewComiteOptions {
  ipAddress?: string;
  userAgent?: string;
}

const FINAL_VALIDATION_STATUSES: ValidationStatus[] = [
  ValidationStatus.APPROVED,
  ValidationStatus.REJECTED,
];

/**
 * Revisión del Comité Evaluador desde el enlace enviado por correo.
 *
 * La identidad del revisor proviene exclusivamente del token firmado
 * (`applicationId` + `committeeUserId`), y además se valida que el usuario
 * siga activo y mantenga el rol COMITE_EVALUADOR.
 */
export class ReviewComiteService {
  async execute(
    token: string,
    action: ReviewComiteAction,
    comment?: string,
    options?: ReviewComiteOptions,
  ): Promise<void> {
    let decoded: { applicationId: number; committeeUserId: number };
    try {
      decoded = verifyComiteReviewToken(token);
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "TokenExpiredError") {
        throw new Error("El enlace ha expirado.");
      }
      throw new Error("El enlace es inválido o no posee un formato correcto.");
    }

    const reason = (comment ?? "").trim();
    if (reason.length > 2000) {
      throw new ReviewComiteError("INVALID_COMMENT", "El motivo excede el máximo de 2000 caracteres.");
    }
    if (action === "REJECT" && reason.length === 0) {
      throw new ReviewComiteError("INVALID_COMMENT", "Debe indicar un motivo para rechazar la postulación.");
    }

    const committeeUser = await prisma.user.findFirst({
      where: {
        id: decoded.committeeUserId,
        status: "ACTIVE",
        role: { slug: "COMITE_EVALUADOR" },
      },
      include: { person: true },
    });
    if (!committeeUser) {
      throw new ReviewComiteError("FORBIDDEN", "El enlace no corresponde a un miembro activo del comité.");
    }

    const application = await prisma.membershipApplication.findUnique({
      where: { id: decoded.applicationId },
      include: { validations: { include: { department: true } } },
    });
    if (!application) {
      throw new ReviewComiteError("NOT_FOUND", "No se encontró el expediente correspondiente.");
    }

    const validation = application.validations.find(
      (item) => item.department?.code === "COMITE",
    );
    if (!validation) {
      throw new ReviewComiteError("NOT_FOUND", "No se encontró la evaluación del Comité para este expediente.");
    }
    if (FINAL_VALIDATION_STATUSES.includes(validation.status)) {
      throw new ReviewComiteError(
        "ALREADY_PROCESSED",
        `La evaluación del Comité ya fue procesada con estado: ${validation.status}.`,
      );
    }

    const newStatus = action === "APPROVE" ? ValidationStatus.APPROVED : ValidationStatus.REJECTED;
    const actionEnum = action === "APPROVE" ? ValidationAction.APPROVED : ValidationAction.REJECTED;
    const reviewerName = committeeUser.person
      ? `${committeeUser.person.firstName} ${committeeUser.person.paternalLastName}`.trim()
      : committeeUser.email;
    const historyComment = action === "APPROVE"
      ? `Aprobado desde el correo del Comité por ${reviewerName}.`
      : `Rechazado desde el correo del Comité por ${reviewerName}. Motivo: ${reason}`;

    const associatesIntegrationService = new AssociatesIntegrationService();
    let integrationId: number | null = null;

    await prisma.$transaction(async (tx) => {
      await tx.membershipValidation.update({
        where: { id: validation.id },
        data: {
          status: newStatus,
          validatedById: committeeUser.id,
          validatedAt: new Date(),
        },
      });

      await tx.membershipValidationHistory.create({
        data: {
          validationId: validation.id,
          userId: committeeUser.id,
          action: actionEnum,
          comment: historyComment,
        },
      });

      await tx.securityEvent.create({
        data: {
          type: Object.values(SecurityEventType)[0],
          ipAddress: options?.ipAddress || "SYSTEM",
          userAgent: options?.userAgent || "EMAIL_ACTION",
          metadata: {
            action: "COMITE_REVIEWED",
            applicationId: decoded.applicationId,
            committeeUserId: committeeUser.id,
            previousStatus: validation.status,
            newStatus,
            reviewedAt: new Date().toISOString(),
          },
        },
      });

      const calculator = new ApplicationStatusCalculatorService(associatesIntegrationService);
      await calculator.recalculate(decoded.applicationId, tx, (preparedIntegrationId) => {
        integrationId = preparedIntegrationId;
      });
    });

    await processPreparedStudentIntegrationAfterCommit(integrationId, associatesIntegrationService);
    if (integrationId !== null) {
      await new AssociateProvisioningService().provisionCompletedApplication(decoded.applicationId);
    }

    await notifyIncorporationPaymentRequest(decoded.applicationId);
  }
}
