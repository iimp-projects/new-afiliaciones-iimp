import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { getSmtpConfig, type SmtpAccount } from "@/lib/config/env";

interface SendMailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  fromName?: string;
  replyTo?: string;
  attachments?: SendMailAttachment[];
}

export interface SendMailResult {
  messageId?: string;
}

/** Error de envío sanitizado: nunca expone credenciales ni configuración SMTP. */
export class MailServiceError extends Error {
  constructor(message: string) { super(message); this.name = "MailServiceError"; }
}

function sanitizeMailError(error: unknown): string {
  const code = (error as { code?: string })?.code;
  const responseCode = (error as { responseCode?: number })?.responseCode;
  if (code === "EAUTH" || responseCode === 535) return "Error de autenticación SMTP.";
  if (code === "ECONNECTION" || code === "ESOCKET" || code === "ETIMEDOUT" || code === "ENOTFOUND" || code === "ECONNREFUSED") {
    return "Conexión SMTP no disponible.";
  }
  return "No se pudo enviar el correo.";
}

export class MailService {
  private transporter?: Transporter;
  private from?: string;

  constructor(private readonly account: SmtpAccount = "DEFAULT") {}

  /**
   * La configuración SMTP se valida al enviar (no al construir), de modo que
   * una integración incompleta no bloquea el arranque ni la construcción de
   * otros servicios que instancian MailService por defecto.
   */
  private getTransporter(): Transporter {
    if (!this.transporter) {
      const config = getSmtpConfig(process.env, this.account);
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

  public async sendMail(options: SendMailOptions): Promise<SendMailResult> {
    const transporter = this.getTransporter();
    try {
      const info = await transporter.sendMail({
        from: `"${options.fromName ?? "IIMP Portal de Afiliaciones"}" <${this.from}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        replyTo: options.replyTo,
        attachments: options.attachments,
      });
      return { messageId: info.messageId };
    } catch (error) {
      throw new MailServiceError(sanitizeMailError(error));
    }
  }

  /**
   * Valida únicamente la PRESENCIA/configuración SMTP de la cuenta, sin abrir
   * conexión ni construir transporter. Lanza ConfigurationError si faltan
   * variables requeridas. Sirve como fail-fast previo a iniciar envíos.
   */
  public validateConfiguration(): void {
    getSmtpConfig(process.env, this.account);
  }
}
