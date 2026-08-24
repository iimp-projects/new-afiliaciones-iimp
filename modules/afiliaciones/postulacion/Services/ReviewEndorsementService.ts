import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";
import { EndorsementStatus, SecurityEventType } from "@prisma/client";
import { ApplicationStatusCalculatorService } from "./ApplicationStatusCalculatorService";
import { MailService } from "@/modules/shared/Services/MailService";

interface ReviewEndorsementPayload {
  applicationId: number;
  sponsorPersonId: number;
}

interface ReviewEndorsementOptions {
  ipAddress?: string;
  userAgent?: string;
}

export class ReviewEndorsementService {
  private readonly mailService = new MailService();

  async execute(
    token: string,
    action: "APPROVE" | "REJECT",
    options?: ReviewEndorsementOptions
  ): Promise<void> {
    let decoded: ReviewEndorsementPayload;

    // 1. Verificar y decodificar el token JWT
    try {
      decoded = jwt.verify(
        token,
        process.env.JWT_SECRET!
      ) as ReviewEndorsementPayload;
    } catch (error: any) {
      if (error.name === "TokenExpiredError") {
        throw new Error("El enlace ha expirado.");
      }
      throw new Error("El enlace es inválido o no posee un formato correcto.");
    }

    const { applicationId, sponsorPersonId } = decoded;

    // 2. Obtener datos de la solicitud y el aval desde Prisma
    const endorsement = await prisma.membershipApproval.findFirst({
      where: {
        applicationId,
        sponsorPersonId,
      },
      include: {
        application: {
          include: {
            person: true,
          },
        },
        sponsorPerson: {
          include: {
            contacts: true,
          },
        },
      },
    });

    if (!endorsement) {
      throw new Error("No se encontró el registro de aval correspondiente.");
    }

    if (endorsement.status !== EndorsementStatus.PENDING) {
      throw new Error(
        `Esta solicitud de aval ya fue procesada anteriormente con estado: ${endorsement.status}.`
      );
    }

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
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "http://localhost:3000";
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

      const htmlContent = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 40px 0; background-color: #f4f6f8; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
          <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; border-collapse: separate; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
            <!-- Encabezado con Logo e Identidad -->
            <tr>
              <td align="center" style="padding: 40px 40px 20px 40px;">
                <img src="https://s3-iimp-gestor-de-archivos-v3.s3.sa-east-1.amazonaws.com/boletines/images/IMG20260817_120138.png" alt="Instituto de Ingenieros de Minas del Perú" width="160" style="display: block; margin-bottom: 20px; border: 0;">
                <p style="margin: 0; font-size: 11px; font-weight: 700; color: #5c768d; letter-spacing: 1.5px; text-transform: uppercase;">
                  ECOSISTEMA DIGITAL DE AFILIACIONES
                </p>
                <h1 style="margin: 8px 0 0 0; font-size: 22px; font-weight: 700; color: #c59b27; text-align: center;">
                  Actualización de Aval
                </h1>
              </td>
            </tr>

            <!-- Línea Divisora -->
            <tr>
              <td style="padding: 0 40px;">
                <div style="border-bottom: 1px solid #edf2f7; width: 100%;"></div>
              </td>
            </tr>

            <!-- Cuerpo del Mensaje -->
            <tr>
              <td style="padding: 30px 40px; color: #2d3748; font-size: 15px; line-height: 1.6;">
                <p style="margin-top: 0;">Estimado(a) <strong>${applicantName.toUpperCase()}</strong>,</p>
                
                <p>Te informamos que tu aval <strong>${sponsorName}</strong> ha evaluado tu solicitud de incorporación como asociado al <strong>Instituto de Ingenieros de Minas del Perú (IIMP)</strong>.</p>
                
                <!-- Caja de Estado / Resultado -->
                <div style="background-color: ${statusBg}; border-radius: 8px; border: 1px solid ${statusColor}30; padding: 20px; margin: 25px 0; text-align: center;">
                  <span style="display: block; font-size: 11px; font-weight: 700; color: #5c768d; letter-spacing: 1.2px; text-transform: uppercase; margin-bottom: 6px;">
                    RESULTADO DEL RESPALDO
                  </span>
                  <span style="font-size: 18px; font-weight: 800; color: ${statusColor}; letter-spacing: 0.5px;">
                    ${statusText}
                  </span>
                </div>

                <p style="margin-bottom: 0;">${statusMessage}</p>

                <!-- Botón de Acción (solo en RECHAZADO) -->
                ${ctaButtonHtml}
              </td>
            </tr>

            <!-- Pie de página -->
            <tr>
              <td style="background-color: #fafbfc; padding: 20px 40px; border-bottom-left-radius: 12px; border-bottom-right-radius: 12px; border-top: 1px solid #edf2f7; text-align: center;">
                <p style="margin: 0; font-size: 12px; color: #a0aec0;">
                  © ${new Date().getFullYear()} Instituto de Ingenieros de Minas del Perú. Todos los derechos reservados.
                </p>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `;

      await this.mailService.sendMail({
        to: applicantEmail,
        subject: "Actualización de Aval - Solicitud de Afiliación",
        html: htmlContent,
      });
    }
  }
}