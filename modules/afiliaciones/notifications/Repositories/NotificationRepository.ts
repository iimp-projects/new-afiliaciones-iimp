import { NotificationStatus, Prisma, type Notification } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface ListNotificationsInput {
  userId: number;
  status?: NotificationStatus;
  type?: string;
  cursor?: number;
  limit: number;
}

export interface NotificationPage {
  items: Notification[];
  nextCursor: number | null;
}

export class NotificationRepository {
  async list(input: ListNotificationsInput): Promise<NotificationPage> {
    const where: Prisma.NotificationWhereInput = { userId: input.userId };
    if (input.status) where.status = input.status;
    if (input.type) where.type = input.type;

    const items = await prisma.notification.findMany({
      where,
      orderBy: { id: "desc" },
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    });

    const hasMore = items.length > input.limit;
    const page = hasMore ? items.slice(0, input.limit) : items;
    const nextCursor = hasMore && page.length > 0 ? page[page.length - 1].id : null;
    return { items: page, nextCursor };
  }

  async countUnread(userId: number): Promise<number> {
    return prisma.notification.count({ where: { userId, status: NotificationStatus.UNREAD } });
  }

  async findOwnedById(id: number, userId: number): Promise<Notification | null> {
    return prisma.notification.findFirst({ where: { id, userId } });
  }

  async markRead(id: number, userId: number): Promise<void> {
    await prisma.notification.updateMany({
      where: { id, userId },
      data: { status: NotificationStatus.READ, readAt: new Date() },
    });
  }

  async markAllRead(userId: number): Promise<number> {
    const result = await prisma.notification.updateMany({
      where: { userId, status: NotificationStatus.UNREAD },
      data: { status: NotificationStatus.READ, readAt: new Date() },
    });
    return result.count;
  }

  async archive(id: number, userId: number): Promise<void> {
    await prisma.notification.updateMany({
      where: { id, userId },
      data: { status: NotificationStatus.ARCHIVED, archivedAt: new Date() },
    });
  }

  async createMany(data: Prisma.NotificationCreateManyInput[]): Promise<number> {
    const result = await prisma.notification.createMany({ data, skipDuplicates: true });
    return result.count;
  }
}
