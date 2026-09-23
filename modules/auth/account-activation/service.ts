import bcrypt from "bcryptjs";
import crypto from "crypto";
import { CredentialType, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { MailService } from "@/modules/shared/Services/MailService";
import { getAppBaseUrl } from "@/lib/config/env";

const ACTIVATION_PREFIX = "account-activation:";
const ACTIVATION_TTL_MS = 24 * 60 * 60 * 1000;

export class AccountActivationError extends Error {}

export class AccountActivationService {
  async resendActivation(email: string): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();
    await new Promise((resolve) => setTimeout(resolve, crypto.randomInt(500, 1_001)));
    const user = await prisma.user.findFirst({ where: { email: { equals: normalizedEmail, mode: "insensitive" }, status: UserStatus.PENDING, deletedAt: null }, select: { id: true } });
    if (user) await this.createAndSendActivation(user.id);
  }

  async createAndSendActivation(userId: number): Promise<void> {
    const activation = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${ACTIVATION_PREFIX}${userId}`}))`;
      const user = await tx.user.findUnique({ where: { id: userId }, include: { person: true, role: { select: { slug: true } }, credentials: { where: { type: CredentialType.PASSWORD, isActive: true }, select: { id: true } } } });
      if (!user || user.deletedAt || user.status === UserStatus.ACTIVE || user.credentials.length) return null;
      const identifier = `${ACTIVATION_PREFIX}${user.id}`;
      await tx.verificationToken.deleteMany({ where: { identifier } });
      const rawToken = crypto.randomBytes(32).toString("base64url");
      await tx.verificationToken.create({ data: { identifier, token: hashToken(rawToken), expires: new Date(Date.now() + ACTIVATION_TTL_MS) } });
      return { rawToken, email: user.email, name: [user.person?.firstName, user.person?.paternalLastName].filter(Boolean).join(" ") || "Usuario", role: user.role?.slug ?? "USUARIO" };
    });
    if (!activation) return;

    try {
      await new MailService().sendMail({ to: activation.email, subject: "Bienvenido al IIMP | Activa tu cuenta", html: activationEmailTemplate(activation.name, activation.email, activation.role, resolveActivationUrl(activation.rawToken)) });
      console.info("[ACCOUNT_ACTIVATION_EMAIL] SENT", { userId, recipient: activation.email });
    } catch (error) {
      console.error("[ACCOUNT_ACTIVATION_EMAIL] FAILED", { userId, recipient: activation.email, error: error instanceof Error ? error.message : "unknown" });
    }
  }

  async getActivationDetails(rawToken: string): Promise<{ email: string } | null> {
    const token = await prisma.verificationToken.findUnique({ where: { token: hashToken(rawToken) } });
    if (!token || !token.identifier.startsWith(ACTIVATION_PREFIX) || token.expires <= new Date()) return null;
    const userId = Number(token.identifier.slice(ACTIVATION_PREFIX.length));
    if (!Number.isInteger(userId)) return null;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, status: true } });
    return user?.status === UserStatus.PENDING ? { email: user.email } : null;
  }

  async consumeActivation(rawToken: string, password: string): Promise<void> {
    const tokenHash = hashToken(rawToken);
    try {
      await prisma.$transaction(async (tx) => {
        const token = await tx.verificationToken.findUnique({ where: { token: tokenHash } });
        if (!token || !token.identifier.startsWith(ACTIVATION_PREFIX) || token.expires <= new Date()) throw new AccountActivationError("INVALID_ACTIVATION");
        const userId = Number(token.identifier.slice(ACTIVATION_PREFIX.length));
        if (!Number.isInteger(userId)) throw new AccountActivationError("INVALID_ACTIVATION");
        const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true, status: true } });
        if (!user || user.status !== UserStatus.PENDING) throw new AccountActivationError("INVALID_ACTIVATION");
        await tx.credential.deleteMany({ where: { userId, type: CredentialType.PASSWORD } });
        await tx.credential.create({ data: { userId, type: CredentialType.PASSWORD, secret: await bcrypt.hash(password, 12), isActive: true } });
        await tx.user.update({ where: { id: userId }, data: { status: UserStatus.ACTIVE, emailVerified: new Date() } });
        await tx.verificationToken.delete({ where: { identifier_token: { identifier: token.identifier, token: tokenHash } } });
      });
    } catch (error) {
      if (error instanceof AccountActivationError) throw error;
      throw new AccountActivationError("INVALID_ACTIVATION");
    }
  }

}

export function resolveActivationUrl(rawToken: string): string {
  let appUrl: string;
  try {
    // AUTH_URL tiene prioridad; nunca cae a localhost para enlaces de activación.
    appUrl = getAppBaseUrl(process.env, { preferAuthUrl: true, allowDevDefault: false });
  } catch {
    throw new AccountActivationError("APP_URL_NOT_CONFIGURED");
  }
  return `${appUrl}/activar-cuenta?token=${encodeURIComponent(rawToken)}`;
}

function hashToken(rawToken: string) { return crypto.createHash("sha256").update(rawToken).digest("hex"); }

function activationEmailTemplate(name: string, email: string, role: string, activationUrl: string) {
  const completion = role === "ASOCIADO_ESTUDIANTE"
    ? "Tu proceso de afiliación como Asociado Estudiante ha sido aprobado y completado."
    : role === "ASOCIADO_ACTIVO"
      ? "Tu proceso de afiliación como Asociado Activo ha sido completado correctamente."
      : "Se ha creado una cuenta institucional para ti.";
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#334155"><h1 style="color:#7f561e">Bienvenido(a) al IIMP</h1><p>Hola, ${escapeHtml(name)}:</p><p>${completion}</p><p>Tu usuario para ingresar al Portal de Asociados es: <strong>${escapeHtml(email)}</strong></p><p>Para proteger tu cuenta, crea tu contraseña mediante el siguiente botón. El enlace tiene una vigencia limitada.</p><p style="margin:28px 0"><a href="${activationUrl}" style="background:#c39254;color:#fff;padding:13px 22px;border-radius:8px;text-decoration:none;font-weight:bold">ACTIVAR MI CUENTA</a></p><p>Instituto de Ingenieros de Minas del Perú</p></div>`;
}

function escapeHtml(value: string) { return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]!); }

export const accountActivationService = new AccountActivationService();
