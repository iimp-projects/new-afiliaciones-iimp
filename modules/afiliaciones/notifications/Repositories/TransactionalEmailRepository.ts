import { Prisma, TransactionalEmailStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface CreateTransactionalEmailInput {
  event?: string;
  templateName?: string;
  applicationId?: number;
  recipient: string;
  correlationId?: string;
  idempotencyKey?: string;
}

export interface CreateTransactionalEmailResult {
  id: number;
  created: boolean;
}

/**
 * Registro persistente y trazable de correos transaccionales.
 *
 * No envía correos: únicamente registra la intención y las transiciones de
 * estado. La clave `idempotency_key` (única) evita duplicar el registro del
 * mismo evento; `ACCEPTED` representa la aceptación por el proveedor SMTP y no
 * la entrega efectiva al destinatario.
 */
export class TransactionalEmailRepository {
  async createOrGetIdempotent(input: CreateTransactionalEmailInput): Promise<CreateTransactionalEmailResult> {
    const data: Prisma.TransactionalEmailCreateInput = {
      event: input.event,
      templateName: input.templateName,
      application: input.applicationId ? { connect: { id: input.applicationId } } : undefined,
      recipient: input.recipient,
      correlationId: input.correlationId,
      idempotencyKey: input.idempotencyKey,
    };

    try {
      const created = await prisma.transactionalEmail.create({ data, select: { id: true } });
      return { id: created.id, created: true };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && input.idempotencyKey) {
        const existing = await prisma.transactionalEmail.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
          select: { id: true },
        });
        if (existing) return { id: existing.id, created: false };
      }
      throw error;
    }
  }

  async markSending(id: number): Promise<void> {
    await prisma.transactionalEmail.update({
      where: { id },
      data: { status: TransactionalEmailStatus.SENDING, attemptCount: { increment: 1 } },
    });
  }

  async markAccepted(id: number, messageId?: string): Promise<void> {
    await prisma.transactionalEmail.update({
      where: { id },
      data: { status: TransactionalEmailStatus.ACCEPTED, messageId: messageId ?? null, smtpAcceptedAt: new Date() },
    });
  }

  async recordFailure(id: number, errorMessage: string, options: { exhausted?: boolean } = {}): Promise<void> {
    const { exhausted = false } = options;
    await prisma.transactionalEmail.update({
      where: { id },
      data: {
        status: exhausted ? TransactionalEmailStatus.EXHAUSTED : TransactionalEmailStatus.FAILED,
        lastError: errorMessage,
        requiresAttention: exhausted,
        attemptCount: { increment: 1 },
      },
    });
  }
}
