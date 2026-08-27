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
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL || "https://tudominio.com";
      const logoUrl = "https://iimp.org.pe/images/iimp_logocolor.png";
      const htmlTemplate = `...`; // (Mantén aquí el HTML que ya tienes en tu archivo)

      await this.mailService.sendMail({
        to: app.email,
        subject: "Código de Verificación - IIMP",
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
