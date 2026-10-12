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

/** Clasificación de errores de envío para decidir reintentos y pausas. */
export type MailErrorKind =
  | "AUTH"
  | "CONNECTION"
  | "RATE_LIMITED"
  | "QUOTA_EXCEEDED"
  | "PERMANENT"
  | "UNKNOWN";

/** Error de envío sanitizado: nunca expone credenciales ni configuración SMTP. */
export class MailServiceError extends Error {
  constructor(message: string, readonly kind: MailErrorKind = "UNKNOWN") {
    super(message);
    this.name = "MailServiceError";
  }
}

const TEMPORARY_SMTP_CODES = new Set([421, 429, 450, 451, 452]);
const QUOTA_TEXT = /daily user sending limit|limit exceeded|sending quota|quota/i;

function sanitizeMailError(error: unknown): { message: string; kind: MailErrorKind } {
  const code = (error as { code?: string })?.code;
  const responseCode = (error as { responseCode?: number })?.responseCode;
  const response = String((error as { response?: string })?.response ?? "");

  if (code === "EAUTH" || responseCode === 535) return { message: "Error de autenticación SMTP.", kind: "AUTH" };
  if (code === "ECONNECTION" || code === "ESOCKET" || code === "ETIMEDOUT" || code === "ENOTFOUND" || code === "ECONNREFUSED") {
    return { message: "Conexión SMTP no disponible.", kind: "CONNECTION" };
  }
  if (QUOTA_TEXT.test(response)) return { message: "Cuota diaria de envío del proveedor alcanzada.", kind: "QUOTA_EXCEEDED" };
  if (responseCode != null && TEMPORARY_SMTP_CODES.has(responseCode)) {
    return { message: "Límite temporal de envío del proveedor alcanzado.", kind: "RATE_LIMITED" };
  }
  if (responseCode != null && (responseCode >= 500 || (responseCode >= 400 && responseCode < 500))) {
    return { message: "El proveedor rechazó el correo de forma permanente.", kind: "PERMANENT" };
  }
  return { message: "No se pudo enviar el correo.", kind: "UNKNOWN" };
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
      const sanitized = sanitizeMailError(error);
      throw new MailServiceError(sanitized.message, sanitized.kind);
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
