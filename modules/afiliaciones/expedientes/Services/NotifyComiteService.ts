import { prisma } from "@/lib/prisma";
import { MailService } from "@/modules/shared/Services/MailService";
import { DeclarationPdfService } from "@/modules/afiliaciones/postulacion/Services/DeclarationPdfService";
import { ValidationAction } from "@prisma/client";

export class NotifyComiteService {
  async execute(applicationId: number, isManualResend: boolean = false, targetUserId?: number, actorId?: number, actorName?: string) {
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

    const draft = typeof app.draftData === 'string' ? JSON.parse(app.draftData) : app.draftData;
    const pdfService = new DeclarationPdfService();
    const pdfBuffer = await pdfService.generate(draft);

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
    const html = `
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

    await mailService.sendMail({
      to: comiteEmails,
      subject: `Nuevo Expediente para Comité - ${postulanteName}`,
      html,
      attachments: [{
        filename: `Expediente_${app.applicationCode}.pdf`,
        content: Buffer.from(pdfBuffer as any),
        contentType: "application/pdf"
      }]
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