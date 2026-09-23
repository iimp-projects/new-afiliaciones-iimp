import crypto from "crypto";
import { MailService } from "@/modules/shared/Services/MailService";
import { getAppBaseUrl } from "@/lib/config/env";
import { verificationTokenRateLimiter } from "@/modules/auth/rate-limit/VerificationTokenRateLimiter";
import { hashVerificationCode } from "@/modules/auth/verification/codeHash";
import { ForgotPasswordRepository } from "./repository";

export const ForgotPasswordService = {
  async processRecoveryRequest(
    email: string,
    ipAddress: string,
  ): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();
    const [ipAllowed, emailAllowed] = await Promise.all([
      verificationTokenRateLimiter.consume("forgot-password:ip", ipAddress, 5, 15),
      verificationTokenRateLimiter.consume("forgot-password:email", normalizedEmail, 5, 15),
    ]);
    if (!ipAllowed || !emailAllowed) throw new Error("RATE_LIMIT_EXCEEDED");

    const user = await ForgotPasswordRepository.findUserByEmail(normalizedEmail);

    // Si el usuario no existe o no está activo, detenemos silenciosamente por seguridad
    if (!user || user.status !== "ACTIVE") {
      await new Promise((resolve) =>
        setTimeout(resolve, crypto.randomInt(500, 1001)),
      );
      return;
    }

    // Generamos un código de 6 dígitos para que el usuario lo escriba
    const code = crypto.randomInt(100000, 1_000_000).toString();

    // Lo hasheamos por seguridad antes de guardarlo en BD
    const tokenHash = hashVerificationCode(code);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutos

    await ForgotPasswordRepository.replaceTokenHash(normalizedEmail, tokenHash, expiresAt);
    await this.sendRecoveryEmail(normalizedEmail, code);
  },

  async sendRecoveryEmail(to: string, code: string): Promise<void> {
    const mailService = new MailService();
    const appUrl = getAppBaseUrl();
    // Creamos el enlace mágico que lleva a la pantalla de reset con el email en la URL
    const resetUrl = `${appUrl}/reset-password?email=${encodeURIComponent(to)}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; border: 1px solid #eaeaea; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #7f561e; padding: 20px; text-align: center;">
          <h2 style="color: #ffffff; margin: 0;">IIMP - Recuperación de Acceso</h2>
        </div>
        <div style="padding: 30px; color: #333; line-height: 1.6; text-align: center;">
          <p>Has solicitado restablecer tu contraseña.</p>
          <p>Ingresa el siguiente código de seguridad en la plataforma:</p>
          <div style="margin: 20px auto; padding: 15px; background-color: #f9f9f9; border: 2px dashed #c39254; border-radius: 12px; display: inline-block;">
             <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #7f561e;">${code}</span>
          </div>
          <p style="font-size: 13px; color: #666; margin-bottom: 20px;">Este código expirará en <strong>30 minutos</strong>.</p>
          
          <a href="${resetUrl}" style="display: inline-block; background-color: #c39254; color: #ffffff; text-decoration: none; padding: 12px 25px; border-radius: 8px; font-weight: bold; font-size: 14px;">
            Ingresar código y cambiar contraseña
          </a>
        </div>
      </div>
    `;

    try {
      await mailService.sendMail({
        to,
        subject: "Código de Verificación - IIMP",
        html,
      });
    } catch (error) {
      console.error("[MailerError]", error);
    }
  },
};
