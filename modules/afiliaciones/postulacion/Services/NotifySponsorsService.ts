import { MailService } from "@/modules/shared/Services/MailService";
import { getAppBaseUrl } from "@/lib/config/env";
import { ApplicationDraft } from "../Models/ApplicationDraft";
import { Application } from "../Entities/Application";
import { DeclarationPdfService } from "../Services/DeclarationPdfService"; 
import { signEndorsementToken } from "./EndorsementToken";
import { prisma } from "@/lib/prisma";
import { emailLayout } from "@/modules/shared/Email/EmailLayout";
import { emailCta, emailInfoBox } from "@/modules/shared/Email/EmailComponents";
import { escapeHtml } from "@/modules/shared/Email/EmailEscaping";

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
        approvalUrl
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

    const payload = {
      applicationId: params.applicationId,
      sponsorPersonId: params.sponsorPersonId,
    };

    const token = signEndorsementToken(payload);

    const approvalUrl = `${baseUrl}/postulacion/avales/revisar?token=${token}`;

    const htmlTemplate = this.buildHtmlTemplate(
      params.sponsorFullName,
      params.applicantName,
      approvalUrl
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
    const htmlTemplate = this.buildApplicantNotificationTemplate(
      params.applicantName,
      params.newSponsorFullName
    );

    await this.mailService.sendMail({
      to: params.applicantEmail,
      subject: `Actualización de Solicitud de Aval`,
      html: htmlTemplate,
    });
  }

  // Template HTML — presentación institucional unificada (aval inicial / reenvío)
  private buildHtmlTemplate(
    sponsorFullName: string,
    applicantName: string,
    approvalUrl: string
  ): string {
    return emailLayout({
      category: "Recordatorio de Aval",
      title: "Su confirmación está pendiente",
      summary: "El Instituto de Ingenieros de Minas del Perú solicita su respaldo institucional.",
      content: `<div style="color:#18253a;font-size:16px;line-height:23px;font-weight:700;margin-bottom:12px;">Estimado(a) ${escapeHtml(sponsorFullName)},</div><div style="color:#4b5563;font-size:14px;line-height:22px;margin-bottom:18px;">Reciba un cordial saludo del <strong style="color:#18253a;">Instituto de Ingenieros de Minas del Perú (IIMP)</strong>. Su respaldo como <strong style="color:#18253a;">aval</strong> sigue pendiente de confirmación.</div>${emailInfoBox(`<div style="color:#9A7838;font-size:14px;line-height:21px;font-weight:bold;margin-bottom:4px;">Postulante a Asociado Activo</div><div style="color:#5f6670;font-size:13px;line-height:20px;">${escapeHtml(applicantName)}</div>`, "neutral")}${emailCta("REVISAR SOLICITUD", approvalUrl)}<div style="color:#7b8491;font-size:13px;line-height:20px;text-align:center;margin-bottom:18px;">El enlace estará disponible por <strong style="color:#18253a;">7 días</strong> por motivos de seguridad.</div><div style="color:#4b5563;font-size:13px;line-height:20px;margin-bottom:3px;">Atentamente,</div><div style="color:#18253a;font-size:13px;line-height:20px;font-weight:bold;margin-bottom:23px;">Instituto de Ingenieros de Minas del Perú (IIMP)</div>`,
    });
  }

  // Template HTML para el Postulante (confirmación de reemplazo de aval)
  private buildApplicantNotificationTemplate(
    applicantName: string,
    newSponsorFullName: string
  ): string {
    return emailLayout({
      category: "Actualización de Aval",
      title: "Actualización de Aval Registrada",
      summary: "Tu nuevo aval fue registrado correctamente.",
      content: `<p>Estimado(a) <strong>${escapeHtml(applicantName)}</strong>,</p><p>Le informamos que ha registrado exitosamente un nuevo aval para su trámite de incorporación.</p>${emailInfoBox(`Nuevo Aval Asignado:<br><strong>${escapeHtml(newSponsorFullName)}</strong>`, "info")}<p>Hemos enviado una solicitud por correo electrónico a su nuevo aval para que proceda con la revisión y respaldo de su expediente.</p>`,
    });
  }
}
