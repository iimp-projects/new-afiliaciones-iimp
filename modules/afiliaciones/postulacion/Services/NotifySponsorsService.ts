import jwt from "jsonwebtoken";
import { MailService } from "@/modules/shared/Services/MailService";
import { ApplicationDraft } from "../Models/ApplicationDraft";
import { Application } from "../Entities/Application";

export class NotifySponsorsService {
  private readonly mailService = new MailService();

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

    // Nombres completos del postulante
    const personal = draft.personalInformation;
    const applicantName = personal
      ? `${personal.names || ""} ${personal.fatherLastName || ""} ${personal.motherLastName || ""}`.trim()
      : "el postulante";

    const attachments = pdfBuffer
      ? [
          {
            filename: "Declaracion_Jurada_Postulante.pdf",
            content: pdfBuffer,
            contentType: "application/pdf",
          },
        ]
      : [];

    const logoUrl =
      "https://s3-iimp-gestor-de-archivos-v3.s3.sa-east-1.amazonaws.com/boletines/images/IMG20260807_134823.png";

    for (const sponsor of sponsors) {
      // 1. Generar token seguro (7 días de vigencia)
      const payload = {
        applicationId: application.id,
        sponsorPersonId: sponsor!.sponsorPersonId,
      };

      const token = jwt.sign(payload, process.env.JWT_SECRET!, {
        expiresIn: "7d",
      });

      // 2. Enlace seguro de validación
      const approvalUrl = `${baseUrl}/postulacion/avales/revisar?token=${token}`;

      // 3. Plantilla clara alineada con la paleta
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
            .title { color: #C39254; font-size: 20px; font-weight: 700; margin: 10px 0 0 0; }
            .subtitle { color: #718096; font-size: 12px; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 600; }
            .content { color: #3E3E3D; font-size: 14px; line-height: 1.6; }
            .info-box { background-color: #F4F5F7; border-left: 4px solid #C39254; padding: 15px 18px; border-radius: 0 8px 8px 0; margin: 22px 0; }
            .info-label { font-size: 11px; text-transform: uppercase; color: #718096; font-weight: 700; letter-spacing: 0.5px; }
            .info-value { font-size: 15px; font-weight: 700; color: #C39254; margin-top: 3px; }
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
              <h2 class="title">Solicitud de Respaldo Institucional</h2>
            </div>
            
            <div class="content">
              <p>Estimado(a) <strong>${sponsor!.sponsorFullName}</strong>,</p>
              
              <p>Le saludamos cordialmente del Instituto de Ingenieros de Minas del Perú (IIMP).</p>

              <div class="info-box">
                <div class="info-label">Postulante a Asociado Activo</div>
                <div class="info-value">${applicantName}</div>
              </div>

              <p>El postulante lo ha designado como <strong>aval</strong> para respaldar su incorporación a nuestra institución.</p>
              
              <p>Adjunto a este correo encontrará la ficha oficial y declaración jurada registrada para su revisión previa.</p>

              <div class="btn-container">
                <a href="${approvalUrl}" class="btn">Revisar y Validar Postulación →</a>
              </div>

              <p style="font-size: 12px; color: #64748B; text-align: center;">Este enlace vencerá en 7 días por motivos de seguridad.</p>
            </div>

            <div class="footer">
              © ${new Date().getFullYear()} Instituto de Ingenieros de Minas del Perú<br>
              Calle Los Canarios 155, Urb. San César II Etapa, La Molina, Lima - Perú
            </div>
          </div>
        </body>
        </html>
      `;

      // 4. Enviar correo
      await this.mailService.sendMail({
        to: sponsor!.sponsorEmail!,
        subject: "Solicitud de Respaldo Institucional - Postulación IIMP",
        html: htmlTemplate,
        attachments,
      });
    }
  }
}