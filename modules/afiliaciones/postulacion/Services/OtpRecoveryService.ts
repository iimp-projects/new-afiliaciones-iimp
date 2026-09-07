import { VerificationError } from "@/modules/shared/Models/VerificationError";
import { randomInt } from "crypto";
import { MailService } from "@/modules/shared/Services/MailService";
import { SmsService } from "@/modules/shared/Services/SmsService";
import { WhatsAppService } from "@/modules/shared/Services/WhatsAppService";
import { VerificationRepository } from "../Repositories/VerificationRepository";
import { destinationChannels, type VerificationChannel, type VerificationContext } from "@/modules/shared/Models/Verification";

export class OtpRecoveryService {
  constructor(
    private readonly repository = new VerificationRepository(),
    private readonly mailService = new MailService(),
    private readonly smsService = new SmsService(),
    private readonly whatsappService = new WhatsAppService(),
  ) {}

  async generateAndSendOtp(identifier: string | number, channel: VerificationChannel = "EMAIL", context: VerificationContext = "RESUME_APPLICATION"): Promise<void> {
    const app = await this.repository.findApplication(identifier);
    if (!app) throw new VerificationError("Postulación no encontrada.");
    if (!destinationChannels(app.email, app.phone).some((option) => option.channel === channel)) throw new VerificationError("El canal seleccionado no está disponible.");
    const code = randomInt(100000, 1000000).toString();
    const destination = (channel === "EMAIL" ? app.email : app.phone).trim();
    const otp = await this.repository.reserve(app.id, channel, destination, code, context);
    try {
      if (channel === "EMAIL") {
        await this.mailService.sendMail({
          to: destination,
          subject: context === "APPLICATION_QUERY" ? "Código de verificación para consultar su postulación" : "Código de Verificación - IIMP",
          html: `<h1>Verificación de seguridad IIMP</h1><p>Tu código de verificación es <strong>${code}</strong>.</p><p>Válido por 15 minutos. No lo compartas con nadie.</p>`,
        });
      } else if (channel === "SMS") {
        await this.smsService.sendSms(destination, `IIMP: Tu codigo de verificacion es ${code}. Valido por 15 minutos. No lo compartas con nadie.`);
      } else {
        await this.whatsappService.sendWhatsApp(destination, code);
      }
    } catch {
      await this.repository.invalidate(otp.id);
      throw new VerificationError("No pudimos enviar el código por este medio.");
    }
  }

  async verifyOtp(identifier: string | number, code: string, context: VerificationContext = "RESUME_APPLICATION") {
    if (!/^\d{6}$/.test(code)) throw new VerificationError("El código ingresado no es correcto.");
    const app = await this.repository.findApplication(identifier);
    if (!app) throw new VerificationError("Postulación no encontrada.");
    return this.repository.consume(app.id, code, context);
  }
}
