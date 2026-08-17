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
}