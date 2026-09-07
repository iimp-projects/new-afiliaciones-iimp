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
        subject: `IIMP | Solicitud de respaldo institucional – Postulación de ${applicantName}`,
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
      subject: `IIMP | Solicitud de respaldo institucional – Postulación de ${params.applicantName}`,
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

  // Template HTML — cabecera y pie de página unificados
  private buildHtmlTemplate(
    sponsorFullName: string,
    applicantName: string,
    approvalUrl: string,
    logoUrl: string
  ): string {
    return `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { margin: 0; padding: 30px 10px; background-color: #F4F5F7; font-family: 'Helvetica Neue', Arial, sans-serif; }
          .card { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #E2E8F0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); overflow: hidden; }
          .content { padding: 30px; color: #3E3E3D; font-size: 14px; line-height: 1.7; }
          .info-box { background-color: #F4F5F7; border-left: 4px solid #C39254; padding: 15px 18px; border-radius: 0 6px 6px 0; margin: 20px 0; }
          .info-label { font-size: 11px; text-transform: uppercase; color: #718096; font-weight: 700; letter-spacing: 0.5px; }
          .info-value { font-size: 15px; font-weight: 700; color: #C39254; margin-top: 3px; }
          .btn-container { text-align: center; margin: 28px 0 18px 0; }
          .btn { display: inline-block; background-color: #C39254; color: #ffffff !important; text-decoration: none; padding: 13px 30px; border-radius: 6px; font-weight: 700; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="card">
          <!-- CABECERA -->
          <div style="text-align: center; padding: 35px 30px 25px; border-bottom: 1px solid #EDF2F7;">
            <img src="${logoUrl}" alt="IIMP Logo" style="max-width: 160px; height: auto; display: block; margin: 0 auto 14px;" />
            <p style="margin: 0 0 6px; font-size: 11px; font-weight: 700; color: #C39254; letter-spacing: 1.5px; text-transform: uppercase;">Ecosistema Digital de Afiliaciones</p>
            <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #C39254;">Solicitud de Respaldo Institucional</h1>
          </div>

          <div class="content">
            <p>Estimado(a) <strong>${sponsorFullName}</strong>,</p>
            <p>Reciba un cordial saludo del <strong>Instituto de Ingenieros de Minas del Perú (IIMP)</strong>.</p>

            <div class="info-box">
              <div class="info-label">Postulante a Asociado Activo</div>
              <div class="info-value">${applicantName}</div>
            </div>

            <p>El postulante, <strong>${applicantName}</strong>, ha solicitado su respaldo como <strong>aval</strong> para su postulación como Asociado Activo de nuestra institución.</p>
            <p>Agradeceremos que pueda <strong>revisar y validar la postulación</strong> mediante el siguiente enlace:</p>

            <div class="btn-container">
              <a href="${approvalUrl}" class="btn">Revisar y Validar Postulación →</a>
            </div>

            <p style="font-size: 12px; color: #718096; text-align: center;"><em>El enlace estará disponible por <strong>7 días</strong> por motivos de seguridad.</em></p>
            <p>Agradecemos de antemano su atención y apoyo en este proceso.</p>
            <p><strong>Atentamente,</strong><br>Instituto de Ingenieros de Minas del Perú – IIMP</p>
          </div>

          <!-- PIE DE PÁGINA -->
          <div style="border-top: 1px solid #EDF2F7; padding: 20px 30px; text-align: center; font-size: 11px; color: #94A3B8; line-height: 1.8;">
            © ${new Date().getFullYear()} Instituto de Ingenieros de Minas del Perú<br>
            Calle Los Canarios 155-157, Urb. San César II Etapa, La Molina, Lima 12, Perú<br>
            <a href="mailto:asociados@iimp.org.pe" style="color: #C39254; text-decoration: none;">asociados@iimp.org.pe</a>
            &nbsp;|&nbsp;
            <a href="mailto:liset.otoya@iimp.org.pe" style="color: #C39254; text-decoration: none;">liset.otoya@iimp.org.pe</a><br>
            Lunes a viernes de 09:00 a 18:00 hrs.
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Template HTML para el Postulante (confirmación de reemplazo de aval)
  private buildApplicantNotificationTemplate(
    applicantName: string,
    newSponsorFullName: string,
    trackingCode: string,
    logoUrl: string
  ): string {
    return `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { margin: 0; padding: 30px 10px; background-color: #F4F5F7; font-family: 'Helvetica Neue', Arial, sans-serif; }
          .card { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #E2E8F0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); overflow: hidden; }
          .content { padding: 30px; color: #3E3E3D; font-size: 14px; line-height: 1.7; }
          .info-box { background-color: #F4F5F7; border-left: 4px solid #C39254; padding: 15px 18px; border-radius: 0 6px 6px 0; margin: 20px 0; }
          .info-label { font-size: 11px; text-transform: uppercase; color: #718096; font-weight: 700; letter-spacing: 0.5px; }
          .info-value { font-size: 15px; font-weight: 700; color: #C39254; margin-top: 3px; }
          .code-box { background-color: #F4F5F7; border: 1px solid rgba(195, 146, 84, 0.3); padding: 14px; border-radius: 8px; text-align: center; margin: 18px 0; }
          .code-title { font-size: 11px; color: #718096; text-transform: uppercase; font-weight: 700; }
          .code-value { font-family: monospace; font-size: 16px; font-weight: 700; color: #C39254; margin-top: 4px; }
        </style>
      </head>
      <body>
        <div class="card">
          <!-- CABECERA -->
          <div style="text-align: center; padding: 35px 30px 25px; border-bottom: 1px solid #EDF2F7;">
            <img src="${logoUrl}" alt="IIMP Logo" style="max-width: 160px; height: auto; display: block; margin: 0 auto 14px;" />
            <p style="margin: 0 0 6px; font-size: 11px; font-weight: 700; color: #C39254; letter-spacing: 1.5px; text-transform: uppercase;">Ecosistema Digital de Afiliaciones</p>
            <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #C39254;">Actualización de Aval Registrada</h1>
          </div>

          <div class="content">
            <p>Estimado(a) <strong>${applicantName}</strong>,</p>
            <p>Le informamos que ha registrado exitosamente un nuevo aval para su trámite de incorporación.</p>

            <div class="info-box">
              <div class="info-label">Nuevo Aval Asignado</div>
              <div class="info-value">${newSponsorFullName}</div>
            </div>

            <div class="code-box">
              <div class="code-title">Código de Seguimiento</div>
              <div class="code-value">${trackingCode}</div>
            </div>

            <p>Hemos enviado una solicitud por correo electrónico a su nuevo aval para que proceda con la revisión y respaldo de su expediente.</p>
          </div>

          <!-- PIE DE PÁGINA -->
          <div style="border-top: 1px solid #EDF2F7; padding: 20px 30px; text-align: center; font-size: 11px; color: #94A3B8; line-height: 1.8;">
            © ${new Date().getFullYear()} Instituto de Ingenieros de Minas del Perú<br>
            Calle Los Canarios 155-157, Urb. San César II Etapa, La Molina, Lima 12, Perú<br>
            <a href="mailto:asociados@iimp.org.pe" style="color: #C39254; text-decoration: none;">asociados@iimp.org.pe</a>
            &nbsp;|&nbsp;
            <a href="mailto:liset.otoya@iimp.org.pe" style="color: #C39254; text-decoration: none;">liset.otoya@iimp.org.pe</a><br>
            Lunes a viernes de 09:00 a 18:00 hrs.
          </div>
        </div>
      </body>
      </html>
    `;
  }
}