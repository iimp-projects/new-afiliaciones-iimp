import crypto from "crypto";
import { MailService } from "@/modules/shared/Services/MailService";
import { getAppBaseUrl } from "@/lib/config/env";
import { verificationTokenRateLimiter } from "@/modules/auth/rate-limit/VerificationTokenRateLimiter";
import { hashVerificationCode } from "@/modules/auth/verification/codeHash";
import { ForgotPasswordRepository } from "./repository";
import { emailLayout } from "@/modules/shared/Email/EmailLayout";
import { emailCta, emailInfoBox } from "@/modules/shared/Email/EmailComponents";
import { escapeHtml } from "@/modules/shared/Email/EmailEscaping";

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

    const html = emailLayout({ category: "Seguridad de Cuenta", title: "Recuperación de acceso", summary: "Restablece tu contraseña de forma segura.", variant: "neutral", content: `<p>Has solicitado restablecer tu contraseña.</p><p>Ingresa el siguiente código de seguridad en la plataforma:</p>${emailInfoBox(`<div style="text-align:center;font-size:32px;font-weight:bold;letter-spacing:8px;color:#7F561E;">${escapeHtml(code)}</div>`, "neutral")}<p>Este código expirará en <strong>30 minutos</strong>.</p>${emailCta("RESTABLECER CONTRASEÑA", resetUrl)}` });

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
