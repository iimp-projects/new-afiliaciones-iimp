import jwt from "jsonwebtoken";
import { MailService } from "@/modules/shared/Services/MailService";
import { ApplicationDraft } from "../Models/ApplicationDraft";
import { Application } from "../Entities/Application";
import { DeclarationPdfService } from "../Services/DeclarationPdfService"; 

export class NotifySponsorsService {
  private readonly mailService = new MailService();
  private readonly declarationPdfService = new DeclarationPdfService();

  // 1. Método execute (Modificado para autoregenerar PDF si no viene por parámetro)
  async execute(
    application: Application,
    draft: ApplicationDraft,
    pdfBuffer?: Buffer
  ): Promise<void> {
    const endorsements = draft.endorsements;
    if (!endorsements) return;

    const sponsors = [
      endorsements.firstEndorsement,
      endorsements.secondEndorsement,
    ].filter((e) => e && e.sponsorPersonId && e.sponsorEmail);

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const personal = draft.personalInformation;
    const applicantName = personal
      ? `${personal.names || ""} ${personal.fatherLastName || ""} ${personal.motherLastName || ""}`.trim()
      : "el postulante";

    // Garantizar que siempre haya un buffer de PDF
    let finalPdfBuffer = pdfBuffer;
    if (!finalPdfBuffer) {
      const generatedUint8Array = await this.declarationPdfService.generate(draft);
      finalPdfBuffer = Buffer.from(generatedUint8Array);
    }

    const attachments = [
      {
        filename: "Declaracion_Jurada_Postulante.pdf",
        content: finalPdfBuffer,
        contentType: "application/pdf",
      },
    ];

    const logoUrl =
      "https://s3-iimp-gestor-de-archivos-v3.s3.sa-east-1.amazonaws.com/boletines/images/IMG20260817_120138.png";

    for (const sponsor of sponsors) {
      const payload = {
        applicationId: application.id,
        sponsorPersonId: sponsor!.sponsorPersonId,
      };

      const token = jwt.sign(payload, process.env.JWT_SECRET!, {
        expiresIn: "7d",
      });

      const approvalUrl = `${baseUrl}/postulacion/avales/revisar?token=${token}`;

      const htmlTemplate = this.buildHtmlTemplate(
        sponsor!.sponsorFullName || "Aval",
        applicantName,
        approvalUrl,
        logoUrl
      );

      await this.mailService.sendMail({
        to: sponsor!.sponsorEmail!,
        subject: "Solicitud de Respaldo Institucional - Postulación IIMP",
        html: htmlTemplate,
        attachments,
      });
    }
  }

  // 2. Notificación individual al aval tras reemplazo (Modificado para recibir el draft y adjuntar PDF)
  async sendSingleSponsorNotification(params: {
    applicationId: number;
    sponsorPersonId: number;
    sponsorEmail: string;
    sponsorFullName: string;
    applicantName: string;
    draft: ApplicationDraft;
  }): Promise<void> {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const logoUrl =
      "https://s3-iimp-gestor-de-archivos-v3.s3.sa-east-1.amazonaws.com/boletines/images/IMG20260817_120138.png";

    const payload = {
      applicationId: params.applicationId,
      sponsorPersonId: params.sponsorPersonId,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET!, {
      expiresIn: "7d",
    });

    const approvalUrl = `${baseUrl}/postulacion/avales/revisar?token=${token}`;

    const htmlTemplate = this.buildHtmlTemplate(
      params.sponsorFullName,
      params.applicantName,
      approvalUrl,
      logoUrl
    );

    // Generar PDF 
    let attachments: Array<{ filename: string; content: Buffer; contentType: string }> = [];

    if (params.draft) {
      const pdfUint8Array = await this.declarationPdfService.generate(params.draft);
      attachments = [
        {
          filename: "Declaracion_Jurada_Postulante.pdf",
          content: Buffer.from(pdfUint8Array),
          contentType: "application/pdf",
        },
      ];
    }

    await this.mailService.sendMail({
      to: params.sponsorEmail,
      subject: "Solicitud de Respaldo Institucional - Postulación IIMP",
      html: htmlTemplate,
      attachments,
    });
  }

  // 3. Confirmación al postulante
  async sendApplicantReplacementConfirmation(params: {
    applicantEmail: string;
    applicantName: string;
    newSponsorFullName: string;
    trackingCode: string;
  }): Promise<void> {
    const logoUrl =
      "https://s3-iimp-gestor-de-archivos-v3.s3.sa-east-1.amazonaws.com/boletines/images/IMG20260817_120138.png";

    const htmlTemplate = this.buildApplicantNotificationTemplate(
      params.applicantName,
      params.newSponsorFullName,
      params.trackingCode,
      logoUrl
    );

    await this.mailService.sendMail({
      to: params.applicantEmail,
      subject: `Actualización de Solicitud de Aval - Código ${params.trackingCode}`,
      html: htmlTemplate,
    });
  }

  // Template HTML con encabezado y footer 
  private buildHtmlTemplate(
    sponsorFullName: string,
    applicantName: string,
    approvalUrl: string,
    logoUrl: string
  ): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #F4F5F7; margin: 0; padding: 25px 10px; }
          .card { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #E2E8F0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
          .banner-header { background-color: #C39254; padding: 25px 20px; text-align: center; }
          .logo { max-width: 170px; height: auto; filter: brightness(0) invert(1); }
          .header-title { color: #ffffff; font-size: 16px; font-weight: 700; margin-top: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
          .content { padding: 30px 25px; color: #3E3E3D; font-size: 14px; line-height: 1.6; }
          .info-box { background-color: #F4F5F7; border-left: 4px solid #C39254; padding: 15px 18px; border-radius: 0 6px 6px 0; margin: 20px 0; }
          .info-label { font-size: 11px; text-transform: uppercase; color: #718096; font-weight: 700; letter-spacing: 0.5px; }
          .info-value { font-size: 15px; font-weight: 700; color: #C39254; margin-top: 3px; }
          .btn-container { text-align: center; margin: 28px 0 18px 0; }
          .btn { display: inline-block; background-color: #C39254; color: #ffffff !important; text-decoration: none; padding: 13px 30px; border-radius: 6px; font-weight: 700; font-size: 14px; }
          
          .footer-banner { background-color: #C39254; color: #ffffff; padding: 25px 20px; font-size: 11px; line-height: 1.5; }
          .footer-grid { display: table; width: 100%; }
          .footer-col-left { display: table-cell; width: 50%; vertical-align: top; padding-right: 10px; }
          .footer-col-right { display: table-cell; width: 50%; vertical-align: top; padding-left: 10px; }
          .footer-heading { font-weight: 700; text-transform: uppercase; margin-bottom: 4px; font-size: 11px; letter-spacing: 0.5px; }
          .footer-link { color: #ffffff !important; text-decoration: underline; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="banner-header">
            <img src="${logoUrl}" alt="IIMP Logo" class="logo" />
            <div class="header-title">Solicitud de Respaldo Institucional</div>
          </div>
          
          <div class="content">
            <p>Estimado(a) <strong>${sponsorFullName}</strong>,</p>
            <p>Le saludamos cordialmente del Instituto de Ingenieros de Minas del Perú (IIMP).</p>

            <div class="info-box">
              <div class="info-label">Postulante a Asociado Activo</div>
              <div class="info-value">${applicantName}</div>
            </div>

            <p>El postulante lo ha designado como <strong>aval</strong> para respaldar su incorporación a nuestra institución.</p>

            <div class="btn-container">
              <a href="${approvalUrl}" class="btn">Revisar y Validar Postulación →</a>
            </div>

            <p style="font-size: 12px; color: #718096; text-align: center;">Este enlace vencerá en 7 días por motivos de seguridad.</p>
          </div>

          <div class="footer-banner">
            <div class="footer-grid">
              <div class="footer-col-left">
                <strong>INSTITUTO DE INGENIEROS DE MINAS DEL PERÚ</strong><br><br>
                © Copyright ${new Date().getFullYear()} - Instituto de Ingenieros de Minas del Perú, todos los derechos reservados.
              </div>
              <div class="footer-col-right">
                <div class="footer-heading">Dirección</div>
                Calle Los Canarios 155-157, Urb. San César II Etapa, La Molina, Lima 12, Perú<br><br>
                <div class="footer-heading">Horario de Atención</div>
                Lunes a viernes de 09:00 a 18:00 hrs.<br><br>
                <a href="mailto:iimp@iimp.org.pe" class="footer-link">iimp@iimp.org.pe</a> | 
                <a href="mailto:liset.otoya@iimp.org.pe" class="footer-link">liset.otoya@iimp.org.pe</a>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Template HTML para el Postulante
  private buildApplicantNotificationTemplate(
    applicantName: string,
    newSponsorFullName: string,
    trackingCode: string,
    logoUrl: string
  ): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #F4F5F7; margin: 0; padding: 25px 10px; }
          .card { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #E2E8F0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
          .banner-header { background-color: #C39254; padding: 25px 20px; text-align: center; }
          .logo { max-width: 170px; height: auto; filter: brightness(0) invert(1); }
          .header-title { color: #ffffff; font-size: 16px; font-weight: 700; margin-top: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
          .content { padding: 30px 25px; color: #3E3E3D; font-size: 14px; line-height: 1.6; }
          .info-box { background-color: #F4F5F7; border-left: 4px solid #C39254; padding: 15px 18px; border-radius: 0 6px 6px 0; margin: 20px 0; }
          .info-label { font-size: 11px; text-transform: uppercase; color: #718096; font-weight: 700; letter-spacing: 0.5px; }
          .info-value { font-size: 15px; font-weight: 700; color: #C39254; margin-top: 3px; }
          
          .footer-banner { background-color: #C39254; color: #ffffff; padding: 25px 20px; font-size: 11px; line-height: 1.5; }
          .footer-grid { display: table; width: 100%; }
          .footer-col-left { display: table-cell; width: 50%; vertical-align: top; padding-right: 10px; }
          .footer-col-right { display: table-cell; width: 50%; vertical-align: top; padding-left: 10px; }
          .footer-heading { font-weight: 700; text-transform: uppercase; margin-bottom: 4px; font-size: 11px; letter-spacing: 0.5px; }
          .footer-link { color: #ffffff !important; text-decoration: underline; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="banner-header">
            <img src="${logoUrl}" alt="IIMP Logo" class="logo" />
            <div class="header-title">Actualización de Aval Registrada</div>
          </div>
          
          <div class="content">
            <p>Estimado(a) <strong>${applicantName}</strong>,</p>
            <p>Le informamos que ha registrado exitosamente un nuevo aval para su trámite de incorporación.</p>

            <div class="info-box">
              <div class="info-label">Nuevo Aval Asignado</div>
              <div class="info-value">${newSponsorFullName}</div>
            </div>

            <p>Hemos enviado una solicitud por correo electrónico a su nuevo aval para que proceda con la revisión y respaldo de su expediente.</p>
            <p>Puede continuar haciendo seguimiento a su trámite mediante su código de seguimiento: <strong>${trackingCode}</strong>.</p>
          </div>

          <div class="footer-banner">
            <div class="footer-grid">
              <div class="footer-col-left">
                <strong>INSTITUTO DE INGENIEROS DE MINAS DEL PERÚ</strong><br><br>
                © Copyright ${new Date().getFullYear()} - Instituto de Ingenieros de Minas del Perú, todos los derechos reservados.
              </div>
              <div class="footer-col-right">
                <div class="footer-heading">Dirección</div>
                Calle Los Canarios 155-157, Urb. San César II Etapa, La Molina, Lima 12, Perú<br><br>
                <div class="footer-heading">Horario de Atención</div>
                Lunes a viernes de 09:00 a 18:00 hrs.<br><br>
                <a href="mailto:iimp@iimp.org.pe" class="footer-link">iimp@iimp.org.pe</a> | 
                <a href="mailto:liset.otoya@iimp.org.pe" class="footer-link">liset.otoya@iimp.org.pe</a>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}