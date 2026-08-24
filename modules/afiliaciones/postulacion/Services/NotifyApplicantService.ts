import { MailService } from "@/modules/shared/Services/MailService";
import type { ApplicationDraft } from "../Models/ApplicationDraft";
import type { Application } from "../Entities/Application";

export class NotifyApplicantService {
  private readonly mailService = new MailService();

  async execute(
    application: Application,
    draft: ApplicationDraft,
    pdfBuffer?: Buffer
  ): Promise<void> {
    // ✅ Corregido: Ahora busca 'primaryEmail' de acuerdo a tu JSON
    const personal = (draft as any)?.personalInformation;
    const draftEmail = personal?.primaryEmail || personal?.email || (draft as any)?.email;
    const recipientEmail = application.email || draftEmail;

    console.log("[NotifyApplicantService] Email destino:", recipientEmail);

    if (!recipientEmail) {
      console.error("[NotifyApplicantService] No se encontró email para el postulante.");
      return;
    }

    const applicantName = personal
      ? `${personal.names || ""} ${personal.fatherLastName || ""} ${personal.motherLastName || ""}`.trim()
      : "Postulante";

    const trackingCode = application.trackingCode || application.applicationCode;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const trackingUrl = `${baseUrl}/consulta`;

    const logoUrl =
      "https://s3-iimp-gestor-de-archivos-v3.s3.sa-east-1.amazonaws.com/boletines/images/IMG20260817_120138.png";

    const htmlTemplate = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Hanken Grotesk', 'Helvetica Neue', Arial, sans-serif; background-color: #F4F5F7; margin: 0; padding: 25px 15px; }
          .card { max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; padding: 35px 30px; border: 1px solid #E2E8F0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
          .header { text-align: center; margin-bottom: 25px; border-bottom: 1px solid #F4F5F7; padding-bottom: 20px; }
          .logo { max-width: 170px; height: auto; margin-bottom: 12px; }
          .subtitle { color: #718096; font-size: 11px; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 700; margin-bottom: 4px; }
          .title { color: #C39254; font-size: 20px; font-weight: 700; margin: 0; }
          .content { color: #3E3E3D; font-size: 14px; line-height: 1.6; }
          .code-box { background-color: #F4F5F7; border: 1px solid rgba(195, 146, 84, 0.3); padding: 18px; border-radius: 8px; text-align: center; margin: 22px 0; }
          .code-title { font-size: 11px; color: #718096; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; }
          .code-value { font-family: monospace; font-size: 16px; font-weight: 700; color: #C39254; margin-top: 6px; word-break: break-all; }
          .btn-container { text-align: center; margin: 30px 0 20px 0; }
          .btn { display: inline-block; background-color: #C39254; color: #ffffff !important; text-decoration: none; padding: 13px 32px; border-radius: 8px; font-weight: 700; font-size: 14px; }
          .footer { text-align: center; font-size: 11px; color: #94A3B8; margin-top: 25px; line-height: 1.5; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <img src="${logoUrl}" alt="IIMP Logo" class="logo" />
            <div class="subtitle">Ecosistema Digital de Afiliaciones</div>
            <h2 class="title">Confirmación de Solicitud</h2>
          </div>
          
          <div class="content">
            <p>Estimado(a) <strong>${applicantName}</strong>,</p>
            
            <p>Confirmamos que su solicitud de incorporación como asociado al <strong>Instituto de Ingenieros de Minas del Perú (IIMP)</strong> ha sido registrada exitosamente.</p>
            
            <div class="code-box">
              <div class="code-title">Código de Seguimiento / Verificación</div>
              <div class="code-value">${trackingCode}</div>
            </div>

            <p>Puede hacer seguimiento al estado de su trámite ingresando a nuestro portal con su número de documento y este código asignado.</p>

            <div class="btn-container">
              <a href="${trackingUrl}" class="btn">Consultar Estado de Solicitud →</a>
            </div>

            <p style="font-size: 12px; color: #64748B; text-align: center;">Adjunto a este correo encontrará el archivo PDF con su Declaración Jurada y Ficha Oficial registrada.</p>
          </div>

          <div class="footer">
            © ${new Date().getFullYear()} Instituto de Ingenieros de Minas del Perú<br>
            Calle Los Canarios 155, Urb. San César II Etapa, La Molina, Lima - Perú
          </div>
        </div>
      </body>
      </html>
    `;

    const attachments = pdfBuffer
      ? [
          {
            filename: "Declaracion_Jurada_IIMP.pdf",
            content: pdfBuffer,
            contentType: "application/pdf",
          },
        ]
      : [];

    try {
      await this.mailService.sendMail({
        to: recipientEmail,
        subject: "Confirmación de Solicitud - Postulación IIMP",
        html: htmlTemplate,
        attachments,
      });
      console.log("[NotifyApplicantService] Correo enviado exitosamente a:", recipientEmail);
    } catch (error) {
      console.error("[NotifyApplicantService] Error al enviar con MailService:", error);
      throw error;
    }
  }

  async notifyCorrectionReceived(
    application: Application,
    draft?: any
  ): Promise<void> {
    const personal = draft?.personalInformation;
    const draftEmail = personal?.primaryEmail || personal?.email;
    const recipientEmail = application.email || draftEmail;

    if (!recipientEmail) {
      console.error("[NotifyApplicantService] No se encontró email para enviar confirmación de subsanación.");
      return;
    }

    const applicantName = personal
      ? `${personal.names || ""} ${personal.fatherLastName || ""} ${personal.motherLastName || ""}`.trim()
      : "Postulante";

    const trackingCode = application.trackingCode || application.applicationCode;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const trackingUrl = `${baseUrl}/consulta`;

    const logoUrl =
      "https://s3-iimp-gestor-de-archivos-v3.s3.sa-east-1.amazonaws.com/boletines/images/IMG20260817_120138.png";

    const htmlTemplate = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Hanken Grotesk', 'Helvetica Neue', Arial, sans-serif; background-color: #F4F5F7; margin: 0; padding: 25px 15px; }
          .card { max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; padding: 35px 30px; border: 1px solid #E2E8F0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
          .header { text-align: center; margin-bottom: 25px; border-bottom: 1px solid #F4F5F7; padding-bottom: 20px; }
          .logo { max-width: 170px; height: auto; margin-bottom: 12px; }
          .subtitle { color: #718096; font-size: 11px; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 700; margin-bottom: 4px; }
          .title { color: #C39254; font-size: 20px; font-weight: 700; margin: 0; }
          .content { color: #3E3E3D; font-size: 14px; line-height: 1.6; }
          .code-box { background-color: #F4F5F7; border: 1px solid rgba(195, 146, 84, 0.3); padding: 18px; border-radius: 8px; text-align: center; margin: 22px 0; }
          .code-title { font-size: 11px; color: #718096; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; }
          .code-value { font-family: monospace; font-size: 16px; font-weight: 700; color: #C39254; margin-top: 6px; word-break: break-all; }
          .btn-container { text-align: center; margin: 30px 0 20px 0; }
          .btn { display: inline-block; background-color: #C39254; color: #ffffff !important; text-decoration: none; padding: 13px 32px; border-radius: 8px; font-weight: 700; font-size: 14px; }
          .footer { text-align: center; font-size: 11px; color: #94A3B8; margin-top: 25px; line-height: 1.5; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <img src="${logoUrl}" alt="IIMP Logo" class="logo" />
            <div class="subtitle">Ecosistema Digital de Afiliaciones</div>
            <h2 class="title">Subsanación de Solicitud Recibida</h2>
          </div>
          
          <div class="content">
            <p>Estimado(a) <strong>${applicantName}</strong>,</p>
            
            <p>Le confirmamos que la información y documentación corregida para su solicitud de incorporación al <strong>Instituto de Ingenieros de Minas del Perú (IIMP)</strong> ha sido registrada exitosamente.</p>
            
            <div class="code-box">
              <div class="code-title">Código de Seguimiento</div>
              <div class="code-value">${trackingCode}</div>
            </div>

            <p>Su expediente ha pasado nuevamente a estado de <strong>evaluación</strong> por el área correspondiente. Por favor, permanezca atento(a) a la respuesta institucional.</p>

            <div class="btn-container">
              <a href="${trackingUrl}" class="btn">Consultar Estado de Solicitud →</a>
            </div>
          </div>

          <div class="footer">
            © ${new Date().getFullYear()} Instituto de Ingenieros de Minas del Perú<br>
            Calle Los Canarios 155, Urb. San César II Etapa, La Molina, Lima - Perú
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await this.mailService.sendMail({
        to: recipientEmail,
        subject: "Subsanación Recibida - Solicitud de Afiliación IIMP",
        html: htmlTemplate,
      });
      console.log("[NotifyApplicantService] Correo de confirmación de subsanación enviado a:", recipientEmail);
    } catch (error) {
      console.error("[NotifyApplicantService] Error al enviar correo de subsanación:", error);
    }
  }

  async notifyObservationCreated(
    applicationId: number,
    observationComment?: string,
    observedFieldPaths: string[] = []
  ): Promise<void> {
    const { prisma } = await import("@/lib/prisma");
    const { OBSERVATION_FIELDS } = await import("@/modules/afiliaciones/observations/ObservationFields");

    const application = await prisma.membershipApplication.findUnique({
      where: { id: applicationId },
      include: { person: true },
    });

    if (!application) return;

    const draft = (application.draftData ?? {}) as Record<string, any>;
    const personal = draft.personalInformation;
    const recipientEmail =
      application.email ||
      personal?.primaryEmail ||
      personal?.email ||
      (application.person as any)?.email;

    if (!recipientEmail) {
      console.error("[NotifyApplicantService] No se encontró correo para notificar la observación.");
      return;
    }

    const applicantName =
      (application.person
        ? `${application.person.firstName || ""} ${application.person.paternalLastName || ""}`.trim()
        : null) ||
      (personal
        ? `${personal.names || ""} ${personal.fatherLastName || ""} ${personal.motherLastName || ""}`.trim()
        : null) ||
      "Postulante";

    const trackingCode = application.trackingCode || application.applicationCode;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const trackingUrl = `${baseUrl}/consulta`;
    const logoUrl =
      "https://s3-iimp-gestor-de-archivos-v3.s3.sa-east-1.amazonaws.com/boletines/images/IMG20260817_120138.png";

    // Mapear los nombres amigables de los campos observados
    const fieldLabels = observedFieldPaths
      .map((path) => OBSERVATION_FIELDS.find((f) => f.key === path)?.label || path)
      .filter(Boolean);

    const htmlTemplate = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Hanken Grotesk', 'Helvetica Neue', Arial, sans-serif; background-color: #F4F5F7; margin: 0; padding: 25px 15px; }
          .card { max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; padding: 35px 30px; border: 1px solid #E2E8F0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
          .header { text-align: center; margin-bottom: 25px; border-bottom: 1px solid #F4F5F7; padding-bottom: 20px; }
          .logo { max-width: 170px; height: auto; margin-bottom: 12px; }
          .subtitle { color: #D97706; font-size: 11px; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 700; margin-bottom: 4px; }
          .title { color: #B45309; font-size: 20px; font-weight: 700; margin: 0; }
          .content { color: #3E3E3D; font-size: 14px; line-height: 1.6; }
          .obs-box { background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 16px; border-radius: 6px; margin: 18px 0; color: #92400E; }
          .field-list { background-color: #F8FAFC; border: 1px solid #E2E8F0; padding: 15px 20px; border-radius: 8px; margin: 18px 0; }
          .field-item { padding: 4px 0; color: #334155; font-weight: 600; font-size: 13px; }
          .code-box { background-color: #F4F5F7; border: 1px solid rgba(195, 146, 84, 0.3); padding: 14px; border-radius: 8px; text-align: center; margin: 18px 0; }
          .code-title { font-size: 11px; color: #718096; text-transform: uppercase; font-weight: 700; }
          .code-value { font-family: monospace; font-size: 16px; font-weight: 700; color: #C39254; margin-top: 4px; }
          .btn-container { text-align: center; margin: 26px 0 16px 0; }
          .btn { display: inline-block; background-color: #D97706; color: #ffffff !important; text-decoration: none; padding: 13px 32px; border-radius: 8px; font-weight: 700; font-size: 14px; }
          .footer { text-align: center; font-size: 11px; color: #94A3B8; margin-top: 25px; line-height: 1.5; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <img src="${logoUrl}" alt="IIMP Logo" class="logo" />
            <div class="subtitle">Ecosistema Digital de Afiliaciones</div>
            <h2 class="title">Observación en su Solicitud</h2>
          </div>
          
          <div class="content">
            <p>Estimado(a) <strong>${applicantName}</strong>,</p>
            
            <p>Le informamos que el equipo evaluador del <strong>Instituto de Ingenieros de Minas del Perú (IIMP)</strong> ha revisado su expediente y ha registrado observaciones que requieren su subsanación.</p>
            
            <div class="code-box">
              <div class="code-title">Código de Seguimiento</div>
              <div class="code-value">${trackingCode}</div>
            </div>

            ${
              observationComment
                ? `
            <div class="obs-box">
              <strong>Motivo de la Observación:</strong><br />
              ${observationComment}
            </div>`
                : ""
            }

            ${
              fieldLabels.length > 0
                ? `
            <div class="field-list">
              <div style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: #64748B; margin-bottom: 8px;">
                Campos o Documentos a Corregir:
              </div>
              <ul style="margin: 0; padding-left: 18px;">
                ${fieldLabels.map((f) => `<li class="field-item">${f}</li>`).join("")}
              </ul>
            </div>`
                : ""
            }

            <p style="font-size: 13px; color: #DC2626; font-weight: bold; text-align: center;">
              ⏳ Cuenta con un plazo de 5 días hábiles para ingresar al portal y subsanar las observaciones.
            </p>

            <div class="btn-container">
              <a href="${trackingUrl}" class="btn">Subsanar Observaciones en el Portal →</a>
            </div>
          </div>

          <div class="footer">
            © ${new Date().getFullYear()} Instituto de Ingenieros de Minas del Perú<br>
            Calle Los Canarios 155, Urb. San César II Etapa, La Molina, Lima - Perú
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await this.mailService.sendMail({
        to: recipientEmail,
        subject: "Observaciones en su Solicitud - Afiliaciones IIMP",
        html: htmlTemplate,
      });
      console.log("[NotifyApplicantService] Correo de observación enviado a:", recipientEmail);
    } catch (error) {
      console.error("[NotifyApplicantService] Error al enviar correo de observación:", error);
    }
  }
}