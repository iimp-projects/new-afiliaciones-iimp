import { prisma } from "@/lib/prisma";
import { MailService } from "@/modules/shared/Services/MailService";
import { SmsService } from "@/modules/shared/Services/SmsService";
import { WhatsAppService } from "@/modules/shared/Services/WhatsAppService";

export class OtpRecoveryService {
  private readonly mailService = new MailService();
  private readonly smsService = new SmsService();
  private readonly whatsappService = new WhatsAppService();

  async generateAndSendOtp(
    trackingCode: string,
    channel: "EMAIL" | "SMS" | "WHATSAPP" = "EMAIL",
  ): Promise<void> {
    const app = await prisma.membershipApplication.findUnique({
      where: { trackingCode },
    });
    if (!app) throw new Error("Postulación no encontrada.");

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.verificationCode.updateMany({
      where: {
        applicationId: app.id,
        purpose: "RESUME_APPLICATION",
        verifiedAt: null,
      },
      data: { verifiedAt: new Date() },
    });

    await prisma.verificationCode.create({
      data: {
        applicationId: app.id,
        purpose: "RESUME_APPLICATION",
        channel: channel,
        destination: channel === "EMAIL" ? app.email : app.phone,
        code,
        expiresAt,
      },
    });

    // =====================================
    // RUTEO DE MENSAJES SEGÚN EL CANAL
    // =====================================
    if (channel === "EMAIL") {
      const logoUrl =
        "https://s3-iimp-gestor-de-archivos-v3.s3.sa-east-1.amazonaws.com/boletines/images/IMG20260817_120138.png";

      // Obtener nombre del postulante
      const appWithPerson = await prisma.membershipApplication.findUnique({
        where: { trackingCode },
        include: { person: true },
      });
      const draftData = (app as any).draftData as Record<string, any> | null;
      const personal = draftData?.personalInformation;
      const applicantName =
        (appWithPerson?.person
          ? `${appWithPerson.person.firstName || ""} ${appWithPerson.person.paternalLastName || ""}`.trim()
          : null) ||
        (personal
          ? `${personal.names || ""} ${personal.fatherLastName || ""}`.trim()
          : null) ||
        "Postulante";

      const htmlTemplate = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { margin: 0; padding: 30px 10px; background-color: #F4F5F7; font-family: 'Helvetica Neue', Arial, sans-serif; }
            .card { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #E2E8F0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); overflow: hidden; }
            .content { padding: 30px; color: #3E3E3D; font-size: 14px; line-height: 1.7; }
            .code-box { background-color: #F4F5F7; border: 1px solid rgba(195, 146, 84, 0.3); padding: 20px; border-radius: 8px; text-align: center; margin: 22px 0; }
            .code-title { font-size: 11px; color: #718096; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; }
            .code-value { font-family: monospace; font-size: 36px; font-weight: 800; color: #C39254; margin-top: 8px; letter-spacing: 6px; }
          </style>
        </head>
        <body>
          <div class="card">
            <!-- CABECERA -->
            <div style="text-align: center; padding: 35px 30px 25px; border-bottom: 1px solid #EDF2F7;">
              <img src="${logoUrl}" alt="IIMP Logo" style="max-width: 160px; height: auto; display: block; margin: 0 auto 14px;" />
              <p style="margin: 0 0 6px; font-size: 11px; font-weight: 700; color: #C39254; letter-spacing: 1.5px; text-transform: uppercase;">Ecosistema Digital de Afiliaciones</p>
              <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #C39254;">Código de Verificación</h1>
            </div>

            <div class="content">
              <p>Estimado(a) <strong>${applicantName}</strong>,</p>
              <p>Le informamos que se ha generado un código de verificación para acceder a su solicitud de incorporación. El código es de uso personal e intransferible.</p>

              <div class="code-box">
                <div class="code-title">Su Código de Verificación</div>
                <div class="code-value">${code}</div>
              </div>

              <p style="font-size: 13px; color: #DC2626; font-weight: bold; text-align: center;">⏳ Este código es válido por <strong>15 minutos</strong>. No lo comparta con nadie.</p>
              <p style="font-size: 12px; color: #718096; text-align: center;">Si usted no solicitó este código, por favor ignore este mensaje.</p>
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

      await this.mailService.sendMail({
        to: app.email,
        subject: `IIMP | Asignación de código de verificación_ ${applicantName}`,
        html: htmlTemplate,
      });
    } else if (channel === "SMS") {
      const smsMessage = `IIMP: Tu codigo de verificacion es ${code}. Valido por 15 minutos. No lo compartas con nadie.`;
      await this.smsService.sendSms(app.phone, smsMessage);
    } else if (channel === "WHATSAPP") {
      // ✅ Disparamos el mensaje por WhatsApp
      await this.whatsappService.sendWhatsApp(app.phone, code);
    }
  }

  async verifyOtp(trackingCode: string, code: string): Promise<boolean> {
    // (Este método se queda exactamente igual al que ya tenías)
    const app = await prisma.membershipApplication.findUnique({
      where: { trackingCode },
    });
    if (!app) throw new Error("Postulación no encontrada.");

    const activeOtp = await prisma.verificationCode.findFirst({
      where: {
        applicationId: app.id,
        purpose: "RESUME_APPLICATION",
        verifiedAt: null,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!activeOtp) throw new Error("No hay códigos pendientes solicitados.");
    if (activeOtp.expiresAt < new Date())
      throw new Error("El código ha expirado.");
    if (activeOtp.attempts >= 3)
      throw new Error("Demasiados intentos fallidos.");

    if (activeOtp.code !== code) {
      await prisma.verificationCode.update({
        where: { id: activeOtp.id },
        data: { attempts: { increment: 1 } },
      });
      throw new Error("Código incorrecto.");
    }

    await prisma.verificationCode.update({
      where: { id: activeOtp.id },
      data: { verifiedAt: new Date() },
    });
    return true;
  }
}
