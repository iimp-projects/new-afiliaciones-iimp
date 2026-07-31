import jwt from "jsonwebtoken";
import { MailService } from "@/modules/shared/Services/MailService";
import { ApplicationDraft } from "../Models/ApplicationDraft";
import { Application } from "../Entities/Application";

export class NotifySponsorsService {
  private readonly mailService = new MailService();

  async execute(application: Application, draft: ApplicationDraft): Promise<void> {
    const endorsements = draft.endorsements;
    if (!endorsements) return;

    const sponsors = [
      endorsements.firstEndorsement,
      endorsements.secondEndorsement,
    ].filter(e => e && e.sponsorPersonId && e.sponsorEmail);

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    for (const sponsor of sponsors) {
      // 1. Generar token seguro que expira en 7 días
      const payload = {
        applicationId: application.id,
        sponsorPersonId: sponsor!.sponsorPersonId,
      };
      
      const token = jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: "7d" });

      // 2. Construir el enlace mágico
      const approvalUrl = `${baseUrl}/postulacion/avales/revisar?token=${token}`;

      // 3. Plantilla del correo (puedes mejorar el HTML usando tu diseño corporativo)
      const htmlTemplate = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px;">
          <h2 style="color: #7f561e;">Solicitud de Respaldo Institucional - IIMP</h2>
          <p>Estimado(a) <strong>${sponsor!.sponsorFullName}</strong>,</p>
          <p>El postulante <strong>${draft.personalInformation?.names} ${draft.personalInformation?.fatherLastName}</strong> lo ha designado como aval para su solicitud de incorporación como Asociado Activo al Instituto de Ingenieros de Minas del Perú.</p>
          <p>Por favor, ingrese al siguiente enlace seguro para revisar la solicitud y emitir su conformidad o rechazo:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${approvalUrl}" style="background-color: #c39254; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Revisar Postulación</a>
          </div>
          <p style="font-size: 12px; color: #666;">Este enlace expirará en 7 días por motivos de seguridad.</p>
        </div>
      `;

      // 4. Enviar correo
      await this.mailService.sendMail({
        to: sponsor!.sponsorEmail!,
        subject: "Solicitud de Respaldo - Postulación IIMP",
        html: htmlTemplate,
      });
    }
  }
}