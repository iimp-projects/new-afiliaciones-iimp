import nodemailer from "nodemailer";

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
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  public async sendMail(options: SendMailOptions): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: `"IIMP Portal de Afiliaciones" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
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