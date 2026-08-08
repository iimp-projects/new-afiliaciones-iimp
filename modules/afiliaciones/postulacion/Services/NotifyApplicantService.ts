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
    // 1. Obtener email del postulante
    const draftEmail = (draft as any)?.personalInformation?.email || (draft as any)?.email;
    const recipientEmail = application.email || draftEmail;

    if (!recipientEmail) return;

    // 2. Nombres del postulante
    const personal = (draft as any)?.personalInformation;
    const applicantName = personal
      ? `${personal.names || ""} ${personal.fatherLastName || ""} ${personal.motherLastName || ""}`.trim()
      : "Postulante";

    // 3. Código de seguimiento
    const trackingCode = application.trackingCode || application.applicationCode;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const trackingUrl = `${baseUrl}/consulta`;

    const htmlTemplate = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #F4F5F7; margin: 0; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; }
          .header { background-color: #3E3E3D; padding: 25px; text-align: center; }
          .header-title { color: #C39254; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
          .header h2 { color: #ffffff; margin: 0; font-size: 20px; }
          .content { padding: 30px; color: #3E3E3D; line-height: 1.6; }
          .code-box { background-color: #F4F5F7; border: 1px solid rgba(195, 146, 84, 0.3); padding: 18px; border-radius: 8px; text-align: center; margin: 20px 0; }
          .code-title { font-size: 11px; color: #3E3E3D; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px; }
          .code-value { font-family: monospace; font-size: 16px; font-weight: bold; color: #C39254; margin-top: 6px; word-break: break-all; }
          .btn { display: inline-block; background-color: #C39254; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: bold; font-size: 14px; margin-top: 10px; }
          .footer { background-color: #F4F5F7; padding: 15px; text-align: center; font-size: 11px; color: #718096; border-top: 1px solid #edf2f7; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="header-title">Portal Oficial de Afiliaciones</div>
            <h2>Instituto de Ingenieros de Minas del Perú</h2>
          </div>
          <div class="content">
            <p>Estimado(a) <strong>${applicantName}</strong>,</p>
            <p>Confirmamos que su solicitud de incorporación como asociado al <strong>IIMP</strong> ha sido registrada exitosamente.</p>
            
            <div class="code-box">
              <div class="code-title">Código de Seguimiento / Verificación</div>
              <div class="code-value">${trackingCode}</div>
            </div>

            <p>Puede hacer seguimiento al estado de su trámite ingresando a nuestro portal con su número de documento y este código asignado.</p>

            <div style="text-align: center; margin: 25px 0;">
              <a href="${trackingUrl}" class="btn">Consultar Estado de Solicitud →</a>
            </div>

            <p style="font-size: 12px; color: #718096;">Adjunto a este correo encontrará el archivo PDF con su Declaración Jurada y Ficha Oficial registrada.</p>
          </div>
          <div class="footer">
            © ${new Date().getFullYear()} Instituto de Ingenieros de Minas del Perú.<br>
            Calle Los Canarios 155, Urb. San César II Etapa, La Molina, Lima - Perú.
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

    await this.mailService.sendMail({
      to: recipientEmail,
      subject: "Confirmación de Solicitud - Postulación IIMP",
      html: htmlTemplate,
      attachments,
    });
  }
}