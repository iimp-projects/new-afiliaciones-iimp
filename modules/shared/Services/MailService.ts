import nodemailer from "nodemailer";
import { getSmtpConfig } from "@/lib/config/env";

interface SendMailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  attachments?: SendMailAttachment[];
}

export class MailService {
  private transporter?: nodemailer.Transporter;
  private from?: string;

  /**
   * La configuración SMTP se valida al enviar (no al construir), de modo que
   * una integración incompleta no bloquea el arranque ni la construcción de
   * otros servicios que instancian MailService por defecto.
   */
  private getTransporter(): nodemailer.Transporter {
    if (!this.transporter) {
      const config = getSmtpConfig();
      this.transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
          user: config.user,
          pass: config.pass,
        },
      });
      this.from = config.from;
    }
    return this.transporter;
  }

  public async sendMail(options: SendMailOptions): Promise<void> {
    const transporter = this.getTransporter();
    try {
      await transporter.sendMail({
        from: `"IIMP Portal de Afiliaciones" <${this.from}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        attachments: options.attachments,
      });
      console.log(`[MailService] Correo enviado exitosamente a: ${options.to}`);
    } catch (error) {
      console.error("[MailService] Error enviando correo:", error);
      throw new Error("No se pudo enviar el correo de verificación. Por favor, intente más tarde.");
    }
  }
}
