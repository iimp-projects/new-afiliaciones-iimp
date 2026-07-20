import crypto from "crypto";
import nodemailer from "nodemailer";
import { ForgotPasswordRepository } from "./repository";

export const ForgotPasswordService = {
  async processRecoveryRequest(email: string, ipAddress: string): Promise<void> {
    const isAllowed = await ForgotPasswordRepository.checkRateLimit(`FORGOT_PW_${ipAddress}`, 5, 15);
    if (!isAllowed) {
      throw new Error("RATE_LIMIT_EXCEEDED");
    }

    const user = await ForgotPasswordRepository.findUserByEmail(email);

    if (!user || !user.isActive) {
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 500 + 500));
      return; 
    }

    await ForgotPasswordRepository.deleteExistingTokens(email);

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    await ForgotPasswordRepository.saveTokenHash(email, tokenHash, expiresAt);
    await this.sendRecoveryEmail(email, rawToken);
  },

  async sendRecoveryEmail(to: string, rawToken: string): Promise<void> {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: process.env.SMTP_SECURE === "true",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const resetUrl = `${appUrl}/reset-password?token=${rawToken}&email=${encodeURIComponent(to)}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; border: 1px solid #eaeaea; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #8A1C2C; padding: 20px; text-align: center;">
          <h2 style="color: #ffffff; margin: 0;">IIMP - Portal de Afiliaciones</h2>
        </div>
        <div style="padding: 30px; color: #333; line-height: 1.6;">
          <p>Hola,</p>
          <p>Hemos recibido una solicitud para restablecer tu contraseña. Por tu seguridad, este enlace expirará en <strong>30 minutos</strong>.</p>
          <a href="${resetUrl}" style="display: block; text-align: center; background-color: #C5A059; color: #fff; text-decoration: none; padding: 12px; border-radius: 6px; font-weight: bold; margin: 25px 0;">Restablecer Contraseña</a>
          <p style="font-size: 13px; color: #666;">Si no realizaste esta solicitud, puedes ignorar este correo de forma segura.</p>
        </div>
      </div>
    `;

    try {
      await transporter.sendMail({
        from: `"IIMP Accesos" <${process.env.SMTP_FROM}>`,
        to,
        subject: "Instrucciones para restablecer tu contraseña",
        html,
      });
    } catch (error) {
      console.error("[MailerError]", error);
    }
  },
};