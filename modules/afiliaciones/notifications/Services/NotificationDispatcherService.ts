import { Prisma } from "@prisma/client";
import { NotificationRepository } from "../Repositories/NotificationRepository";

export interface DispatchNotificationInput {
  type: string;
  severity?: string;
  title: string;
  message: string;
  applicationId?: number;
  entityType?: string;
  entityId?: string;
  href?: string;
  metadata?: Record<string, unknown>;
  dedupBaseKey: string;
  recipientUserIds: number[];
}

/**
 * Persiste una notificación IN_APP por destinatario, de forma idempotente.
 *
 * La clave de deduplicación final es `{dedupBaseKey}:{userId}`, de modo que:
 * - Reintentar el mismo evento no duplica notificaciones (la columna `dedup_key`
 *   tiene una restricción única).
 * - Dos eventos legítimos del mismo tipo (p. ej. dos rondas de subsanación) no se
 *   bloquean entre sí, porque `dedupBaseKey` identifica el evento concreto.
 */
export class NotificationDispatcherService {
  constructor(private readonly repository: NotificationRepository = new NotificationRepository()) {}

  async dispatch(input: DispatchNotificationInput): Promise<number> {
    const { dedupBaseKey, recipientUserIds, ...rest } = input;
    if (recipientUserIds.length === 0) return 0;

    const data: Prisma.NotificationCreateManyInput[] = recipientUserIds.map((userId) => ({
      userId,
      channel: "IN_APP",
      type: rest.type,
      severity: rest.severity ?? "INFO",
      title: rest.title,
      message: rest.message,
      applicationId: rest.applicationId,
      entityType: rest.entityType,
      entityId: rest.entityId,
      href: rest.href,
      metadata: (rest.metadata as Prisma.InputJsonValue) ?? undefined,
      dedupKey: `${dedupBaseKey}:${userId}`,
    }));

    return this.repository.createMany(data);
  }
}
