import crypto from "node:crypto";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const MAX_SERIALIZATION_RETRIES = 3;

function identifierFor(scope: string, subject: string): string {
  const digest = crypto.createHash("sha256").update(subject).digest("hex");
  return `rate-limit:${scope}:${digest}`;
}

export const verificationTokenRateLimiter = {
  async consume(scope: string, subject: string, limit: number, windowMinutes: number): Promise<boolean> {
    const identifier = identifierFor(scope, subject);

    for (let attempt = 0; attempt < MAX_SERIALIZATION_RETRIES; attempt += 1) {
      try {
        return await prisma.$transaction(async (tx) => {
          const now = new Date();
          await tx.verificationToken.deleteMany({
            where: { identifier, expires: { lt: now } },
          });

          const attempts = await tx.verificationToken.count({
            where: { identifier, expires: { gte: now } },
          });
          if (attempts >= limit) return false;

          await tx.verificationToken.create({
            data: {
              identifier,
              token: crypto.randomUUID(),
              expires: new Date(now.getTime() + windowMinutes * 60_000),
            },
          });
          return true;
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2034" || attempt === MAX_SERIALIZATION_RETRIES - 1) {
          throw error;
        }
      }
    }

    return false;
  },

  /**
   * Segundos hasta que el sujeto vuelve a estar habilitado (fin de la ventana
   * deslizante), a partir del intento activo más antiguo. Devuelve null si no
   * hay intentos activos (p. ej. cuando consume() acaba de permitir el acceso).
   */
  async retryAfterSeconds(scope: string, subject: string): Promise<number | null> {
    const identifier = identifierFor(scope, subject);
    const now = new Date();
    const earliest = await prisma.verificationToken.findFirst({
      where: { identifier, expires: { gte: now } },
      orderBy: { expires: "asc" },
      select: { expires: true },
    });
    if (!earliest) return null;
    return Math.max(1, Math.ceil((earliest.expires.getTime() - now.getTime()) / 1000));
  },
};
