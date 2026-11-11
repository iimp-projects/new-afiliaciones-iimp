import { prisma } from "@/lib/prisma";
import { MailService } from "@/modules/shared/Services/MailService";
import { S3StorageService } from "@/modules/shared/Services/S3StorageService";
import { DeclarationPdfService } from "@/modules/afiliaciones/postulacion/Services/DeclarationPdfService";
import { APPLICATION_KEY_PREFIX, LEGACY_DOCUMENT_KEY_PREFIX } from "@/modules/afiliaciones/postulacion/Services/ApplicationDocumentAccess";
import { StatusChangeAttachmentService, type StatusChangeAttachmentRef, type ResolvedEmailAttachment } from "@/modules/afiliaciones/expedientes/Services/StatusChangeAttachmentService";
import { ValidationAction } from "@prisma/client";
import { getAppBaseUrl } from "@/lib/config/env";
import { emailLayout } from "@/modules/shared/Email/EmailLayout";
import { emailCta, emailInfoBox } from "@/modules/shared/Email/EmailComponents";
import { escapeHtml } from "@/modules/shared/Email/EmailEscaping";

export class NotifyComiteService {
  async execute(applicationId: number, isManualResend: boolean = false, targetUserId?: number, actorId?: number, actorName?: string, attachment?: StatusChangeAttachmentRef) {
    const app = await prisma.membershipApplication.findUnique({
      where: { id: applicationId },
      include: {
        person: true,
        approvals: { include: { sponsorPerson: true } },
        validations: { include: { department: true, validatedBy: { include: { person: true } } } }
      }
    });

    if (!app) throw new Error("Solicitud no encontrada.");

    const isStudent = app.affiliateType === "STUDENT";
    const logistica = app.validations.find(v => v.department?.code === "LOGISTICA");
    const asociados = app.validations.find(v => v.department?.code === "ASOCIADOS");

    const logOk = logistica?.status === "APPROVED" || logistica?.status === "RESOLVED";
    const asocOk = asociados?.status === "APPROVED" || asociados?.status === "RESOLVED";
    const avalesAprobados = app.approvals.filter(a => a.status === "APPROVED");
    const avalesOk = isStudent || avalesAprobados.length >= 2;

    if (!logOk || !asocOk || !avalesOk) {
      if (isManualResend) throw new Error("El expediente aún no tiene todas las aprobaciones previas (Logística, Asociados y Avales).");
      return; 
    }

    const logName = logistica?.validatedBy?.person ? `${logistica.validatedBy.person.firstName} ${logistica.validatedBy.person.paternalLastName}` : "Aprobación Automática";
    const asocName = asociados?.validatedBy?.person ? `${asociados.validatedBy.person.firstName} ${asociados.validatedBy.person.paternalLastName}` : "Aprobación Automática";
    const avalesNames = isStudent ? "N/A (Aplica como Estudiante)" : avalesAprobados.map(a => `${a.sponsorPerson?.firstName} ${a.sponsorPerson?.paternalLastName}`).join(" y ");
    const postulanteName = `${app.person?.firstName} ${app.person?.paternalLastName}`;

    // La declaración jurada que recibe el comité debe ser la versión FIRMADA
    // por el postulante. Los expedientes legacy no tienen ese documento
    // almacenado, por lo que en ese caso se conserva la generación histórica.
    const signedDocument = await prisma.applicationDocument.findFirst({
      where: { applicationId, category: "SWORN_DECLARATION" },
      select: { fileUrl: true },
      orderBy: { updatedAt: "desc" },
    });

    let declarationBuffer: Buffer | null = null;
    let declarationFilename = `Declaracion_Jurada_Firmada_${app.applicationCode}.pdf`;
    let declarationNotice = "Se adjunta la Declaración Jurada firmada por el postulante en formato PDF para su respectiva revisión técnica.";
    if (signedDocument?.fileUrl) {
      try {
        declarationBuffer = await new S3StorageService().getObjectBuffer(
          signedDocument.fileUrl,
          [`${APPLICATION_KEY_PREFIX}/${applicationId}`, LEGACY_DOCUMENT_KEY_PREFIX],
        );
      } catch (error) {
        console.error("[NotifyComite] No se pudo leer la declaración firmada; se usará la generada:", error instanceof Error ? error.message : "error desconocido");
      }
    }
    if (!declarationBuffer) {
      const draft = typeof app.draftData === "string" ? JSON.parse(app.draftData) : app.draftData;
      const generated = await new DeclarationPdfService().generate(draft, { allowedApplicationIds: [applicationId] });
      declarationBuffer = Buffer.from(generated);
      declarationFilename = `Declaracion_Jurada_${app.applicationCode}.pdf`;
      declarationNotice = "Se adjunta la Declaración Jurada registrada del postulante en formato PDF para su respectiva revisión técnica.";
    }

    // Filtramos si se eligió a un usuario específico o a todos
    const userWhereClause = targetUserId 
        ? { id: targetUserId, status: "ACTIVE" as any } 
        : { role: { slug: "COMITE_EVALUADOR" }, status: "ACTIVE" as any };

    const comiteUsers = await prisma.user.findMany({
      where: userWhereClause,
      include: { person: true }
    });
    
    const comiteEmails = comiteUsers.map(u => u.email).filter(Boolean).join(",");
    if (!comiteEmails) {
      if (isManualResend) throw new Error("No hay usuarios válidos en el comité para enviar el correo.");
      return;
    }

    const mailService = new MailService();
    const legacyHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eaeaea; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #7f561e; padding: 20px; text-align: center;">
          <h2 style="color: #ffffff; margin: 0;">Expediente Listo para Evaluación</h2>
        </div>
        <div style="padding: 30px; color: #333; line-height: 1.6;">
          <p>Estimados miembros del Comité Evaluador,</p>
          <p>El expediente de <strong>${postulanteName}</strong> (Cód: ${app.applicationCode}) ha superado exitosamente los filtros administrativos previos y está listo para su veredicto final.</p>

          <div style="background-color: #f9f9f9; border-left: 4px solid #c39254; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <h4 style="color: #7f561e; margin-top: 0; margin-bottom: 10px;">Resumen de Aprobaciones:</h4>
            <ul style="list-style: none; padding: 0; margin: 0; font-size: 14px;">
              <li style="margin-bottom: 8px;">✅ <strong>Avales:</strong> Confirmados por ${avalesNames}</li>
              <li style="margin-bottom: 8px;">✅ <strong>Atención al Asociado:</strong> Revisado por ${asocName}</li>
              <li style="margin-bottom: 0px;">✅ <strong>Logística:</strong> Validado por ${logName}</li>
            </ul>
          </div>

          <p>Se adjunta la ficha de postulación en formato PDF para su respectiva revisión técnica.</p>
        </div>
      </div>
    `;

    const loginUrl = `${getAppBaseUrl()}/login`;
    const html = emailLayout({ category: "Comité Evaluador", title: "Expediente Listo para Evaluación", summary: "Notificación interna para Comité Evaluador.", variant: "info", content: `<p>Estimados miembros del Comité Evaluador,</p><p>El expediente de <strong>${escapeHtml(postulanteName)}</strong> (Cód: ${escapeHtml(app.applicationCode)}) ha superado exitosamente los filtros administrativos previos y está listo para su veredicto final.</p>${emailInfoBox(`<strong>Resumen de Aprobaciones:</strong><ul><li>✓ <strong>Avales:</strong> Confirmados por ${escapeHtml(avalesNames)}</li><li>✓ <strong>Atención al Asociado:</strong> Revisado por ${escapeHtml(asocName)}</li><li>✓ <strong>Logística:</strong> Validado por ${escapeHtml(logName)}</li></ul>`, "info")}<p>${declarationNotice}</p>${emailCta("INGRESAR AL PORTAL", loginUrl)}<p style="font-size:12px;color:#667085;text-align:center;">Ingrese con su cuenta institucional para revisar el expediente en el sistema.</p>` });

    const attachments: ResolvedEmailAttachment[] = [{
      filename: declarationFilename,
      content: declarationBuffer,
      contentType: "application/pdf"
    }];
    if (attachment?.attachmentUrl) {
      try {
        const evidence = await new StatusChangeAttachmentService().resolve(attachment);
        attachments.push(...evidence);
      } catch (error) {
        console.error("[NotifyComite] No se pudo adjuntar la evidencia al correo:", error instanceof Error ? error.message : "error desconocido");
        return;
      }
    }

    await mailService.sendMail({
      to: comiteEmails,
      subject: `Nuevo Expediente para Comité - ${postulanteName}`,
      html,
      attachments
    });

    // ¡LA MAGIA DEL HISTORIAL!: Inyectamos el evento en la Línea de Tiempo del expediente
    const comiteValidation = app.validations.find(v => v.department?.code === "COMITE");
    if (comiteValidation) {
        const destNames = comiteUsers.map(u => `${u.person?.firstName} ${u.person?.paternalLastName}`).join(', ');
        await prisma.membershipValidationHistory.create({
            data: {
                validationId: comiteValidation.id,
                userId: actorId || null,
                action: ValidationAction.START_REVIEW,
                comment: `Se envió una notificación y el expediente por correo a: ${destNames}. (Enviado por: ${actorName || 'Sistema'})`
            }
        });
    }
  }
}
