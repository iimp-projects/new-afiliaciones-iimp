import { NotificationStatus } from "@prisma/client";
import { NotificationRepository } from "../Repositories/NotificationRepository";
import { NotificationMapper, type NotificationDTO } from "../Mappers/NotificationMapper";

export class NotificationError extends Error {
  public constructor(message: string, public readonly status: 404 | 422 = 404) {
    super(message);
  }
}

export interface ListNotificationsParams {
  status?: NotificationStatus;
  type?: string;
  cursor?: number;
  limit?: number;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export class NotificationService {
  constructor(private readonly repository: NotificationRepository = new NotificationRepository()) {}

  async list(userId: number, params: ListNotificationsParams): Promise<{ items: NotificationDTO[]; nextCursor: number | null }> {
    const limit = Math.min(Math.max(params.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
    const { items, nextCursor } = await this.repository.list({
      userId,
      status: params.status,
      type: params.type,
      cursor: params.cursor,
      limit,
    });
    return { items: items.map((item) => NotificationMapper.toDTO(item)), nextCursor };
  }

  async unreadCount(userId: number): Promise<number> {
    return this.repository.countUnread(userId);
  }

  async markRead(userId: number, id: number): Promise<void> {
    const owned = await this.repository.findOwnedById(id, userId);
    if (!owned) throw new NotificationError("La notificación no existe.");
    await this.repository.markRead(id, userId);
  }

  async markAllRead(userId: number): Promise<number> {
    return this.repository.markAllRead(userId);
  }

  async archive(userId: number, id: number): Promise<void> {
    const owned = await this.repository.findOwnedById(id, userId);
    if (!owned) throw new NotificationError("La notificación no existe.");
    await this.repository.archive(id, userId);
  }
}
