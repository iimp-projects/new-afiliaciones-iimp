import { MailService } from "@/modules/shared/Services/MailService";
import { getAppBaseUrl } from "@/lib/config/env";
import { ApplicationDraft } from "../Models/ApplicationDraft";
import { Application } from "../Entities/Application";
import { DeclarationPdfService } from "../Services/DeclarationPdfService"; 
import { signEndorsementToken } from "./EndorsementToken";
import { prisma } from "@/lib/prisma";
import { emailFooter, emailLayout, emailLogoUrl } from "@/modules/shared/Email/EmailLayout";
import { emailInfoBox } from "@/modules/shared/Email/EmailComponents";
import { escapeHtml, safeUrl } from "@/modules/shared/Email/EmailEscaping";

export class NotifySponsorsService {
  private readonly mailService = new MailService();
  private readonly declarationPdfService = new DeclarationPdfService();

  // 1. Método execute (adjunta la Declaración Jurada firmada recibida por parámetro)
  async execute(
    application: Application,
    draft: ApplicationDraft,
    signedDeclarationBuffer?: Buffer
  ): Promise<void> {
    const sponsors = await prisma.membershipApproval.findMany({
      where: { applicationId: Number(application.id), status: { not: "INACTIVE" } },
      include: {
        sponsorPerson: {
          include: { user: true, contacts: { where: { isPrimary: true }, take: 1 } },
        },
      },
    });

    const baseUrl = getAppBaseUrl();

    const personal = draft.personalInformation;
    const applicantName = personal
      ? `${personal.names || ""} ${personal.fatherLastName || ""} ${personal.motherLastName || ""}`.trim()
      : "el postulante";

    // La fuente del adjunto es la Declaración Jurada firmada persistida (SWORN_DECLARATION).
    // No se regenera un PDF: si no existe, el correo se envía sin adjunto.
    const attachments = signedDeclarationBuffer
      ? [
        {
          filename: "Declaracion_Jurada_Firmada_Postulante.pdf",
          content: signedDeclarationBuffer,
          contentType: "application/pdf",
        },
      ]
      : [];

    const logoUrl =
      "https://s3-iimp-gestor-de-archivos-v3.s3.sa-east-1.amazonaws.com/boletines/images/IMG20260817_120138.png";

    for (const sponsor of sponsors) {
      const sponsorEmail = sponsor.sponsorPerson.user?.email || sponsor.sponsorPerson.contacts[0]?.email;
      if (!sponsorEmail) continue;
      const sponsorFullName = [sponsor.sponsorPerson.firstName, sponsor.sponsorPerson.paternalLastName, sponsor.sponsorPerson.maternalLastName].filter(Boolean).join(" ");
      const payload = {
        applicationId: application.id,
        sponsorPersonId: sponsor.sponsorPersonId,
      };

      const token = signEndorsementToken(payload);

      const approvalUrl = `${baseUrl}/postulacion/avales/revisar?token=${token}`;

      const htmlTemplate = this.buildHtmlTemplate(
        sponsorFullName || "Aval",
        applicantName,
        approvalUrl,
        logoUrl
      );

      await this.mailService.sendMail({
        to: sponsorEmail,
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
    const baseUrl = getAppBaseUrl();
    const logoUrl =
      "https://s3-iimp-gestor-de-archivos-v3.s3.sa-east-1.amazonaws.com/boletines/images/IMG20260817_120138.png";

    const payload = {
      applicationId: params.applicationId,
      sponsorPersonId: params.sponsorPersonId,
    };

    const token = signEndorsementToken(payload);

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
      const pdfUint8Array = await this.declarationPdfService.generate(params.draft, { allowedApplicationIds: [params.applicationId] });
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
      logoUrl
    );

    await this.mailService.sendMail({
      to: params.applicantEmail,
      subject: `Actualización de Solicitud de Aval`,
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
    const logo = emailLogoUrl() ?? logoUrl;
    const logoCell = logo ? `<img src="${safeUrl(logo)}" alt="Instituto de Ingenieros de Minas del Perú" width="180" style="display:block;width:180px;max-width:100%;height:auto;margin:0 auto 20px;border:0;outline:none;">` : "";
    return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"></head><body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#1f2937;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background-color:#f3f4f6;"><tr><td align="center" style="padding:30px 15px;"><table role="presentation" width="640" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:640px;background-color:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e5e7eb;"><tr><td height="6" style="height:6px;background-color:#C5A059;font-size:0;line-height:0;">&nbsp;</td></tr><tr><td align="center" style="background-color:#ffffff;padding:25px 35px 24px;border-bottom:1px solid #eeeeee;">${logoCell}<table role="presentation" width="55" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:0 auto 18px;"><tr><td height="3" style="height:3px;background-color:#C5A059;font-size:0;line-height:0;">&nbsp;</td></tr></table><div style="color:#9A7838;font-size:11px;line-height:16px;font-weight:bold;letter-spacing:2.4px;text-transform:uppercase;margin-bottom:10px;">Recordatorio de Aval</div><div style="color:#18253a;font-size:24px;line-height:32px;font-weight:700;max-width:550px;margin:0 auto;">Su confirmación está pendiente</div><div style="color:#7b8491;font-size:13px;line-height:20px;margin-top:9px;">El Instituto de Ingenieros de Minas del Perú solicita su respaldo institucional.</div></td></tr><tr><td style="padding:28px 45px 10px;"><div style="color:#18253a;font-size:16px;line-height:23px;font-weight:700;margin-bottom:12px;">Estimado(a) ${escapeHtml(sponsorFullName)},</div><div style="color:#4b5563;font-size:14px;line-height:22px;margin-bottom:18px;">Reciba un cordial saludo del <strong style="color:#18253a;">Instituto de Ingenieros de Minas del Perú (IIMP)</strong>. Su respaldo como <strong style="color:#18253a;">aval</strong> sigue pendiente de confirmación.</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background-color:#faf8f2;border:1px solid #eee4cf;border-radius:10px;margin-bottom:22px;"><tr><td width="5" style="width:5px;background-color:#C5A059;border-radius:10px 0 0 10px;">&nbsp;</td><td style="padding:17px 22px;"><div style="color:#9A7838;font-size:14px;line-height:21px;font-weight:bold;margin-bottom:4px;">Postulante a Asociado Activo</div><div style="color:#5f6670;font-size:13px;line-height:20px;">${escapeHtml(applicantName)}</div></td></tr></table><table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:0 auto 25px;"><tr><td align="center" bgcolor="#C5A059" style="background-color:#C5A059;border-radius:8px;"><a href="${safeUrl(approvalUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:15px 38px;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:20px;font-weight:bold;text-decoration:none;border-radius:8px;">REVISAR SOLICITUD &nbsp;→</a></td></tr></table><div style="color:#7b8491;font-size:13px;line-height:20px;text-align:center;margin-bottom:18px;">El enlace estará disponible por <strong style="color:#18253a;">7 días</strong> por motivos de seguridad.</div><div style="color:#4b5563;font-size:13px;line-height:20px;margin-bottom:3px;">Atentamente,</div><div style="color:#18253a;font-size:13px;line-height:20px;font-weight:bold;margin-bottom:23px;">Instituto de Ingenieros de Minas del Perú (IIMP)</div></td></tr>${emailFooter()}</table></td></tr></table></body></html>`;
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
          .banner-header { background-color: #C39254; padding: 25px 20px; text-align: center; }
          .logo { max-width: 170px; height: auto; filter: brightness(0) invert(1); }
          .header-title { color: #ffffff; font-size: 16px; font-weight: 700; margin-top: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
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
          <!-- CABECERA -->
          <div class="banner-header">
            <img src="${logoUrl}" alt="IIMP Logo" class="logo" />
            <div class="header-title">Solicitud de Respaldo Institucional</div>
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
                <a href="mailto:asociados@iimp.org.pe" class="footer-link">asociados@iimp.org.pe</a> |
                <a href="mailto:liset.otoya@iimp.org.pe" class="footer-link">liset.otoya@iimp.org.pe</a>
              </div>
            </div>
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
    logoUrl: string
  ): string {
    return emailLayout({ title: "Actualización de Aval Registrada", summary: "Tu nuevo aval fue registrado correctamente.", variant: "info", content: `<p>Estimado(a) <strong>${escapeHtml(applicantName)}</strong>,</p><p>Le informamos que ha registrado exitosamente un nuevo aval para su trámite de incorporación.</p>${emailInfoBox(`Nuevo Aval Asignado:<br><strong>${escapeHtml(newSponsorFullName)}</strong>`, "info")}<p>Hemos enviado una solicitud por correo electrónico a su nuevo aval para que proceda con la revisión y respaldo de su expediente.</p>` });
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
          .banner-header { background-color: #C39254; padding: 25px 20px; text-align: center; }
          .logo { max-width: 170px; height: auto; filter: brightness(0) invert(1); }
          .header-title { color: #ffffff; font-size: 16px; font-weight: 700; margin-top: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
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
          <!-- CABECERA -->
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
          </div>

          <!-- PIE DE PÁGINA -->
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
                <a href="mailto:asociados@iimp.org.pe" class="footer-link">asociados@iimp.org.pe</a> |
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
