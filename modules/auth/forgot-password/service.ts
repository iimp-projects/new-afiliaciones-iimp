import crypto from "crypto";
import { MailService } from "@/modules/shared/Services/MailService";
import { ForgotPasswordRepository } from "./repository";

export const ForgotPasswordService = {
  async processRecoveryRequest(
    email: string,
    ipAddress: string,
  ): Promise<void> {
    const user = await ForgotPasswordRepository.findUserByEmail(email);

    // Si el usuario no existe o no está activo, detenemos silenciosamente por seguridad
    if (!user || user.status !== "ACTIVE") {
      await new Promise((resolve) =>
        setTimeout(resolve, Math.random() * 500 + 500),
      );
      return;
    }

    await ForgotPasswordRepository.deleteExistingTokens(email);

    // Generamos un código de 6 dígitos para que el usuario lo escriba
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Lo hasheamos por seguridad antes de guardarlo en BD
    const tokenHash = crypto.createHash("sha256").update(code).digest("hex");
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutos

    await ForgotPasswordRepository.saveTokenHash(email, tokenHash, expiresAt);
    await this.sendRecoveryEmail(email, code);
  },

  async sendRecoveryEmail(to: string, code: string): Promise<void> {
    const mailService = new MailService();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
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
