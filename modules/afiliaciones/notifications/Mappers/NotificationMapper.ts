import type { Notification as PrismaNotification, NotificationStatus } from "@prisma/client";

export interface NotificationDTO {
  id: number;
  type: string | null;
  severity: string | null;
  title: string;
  message: string;
  status: NotificationStatus;
  href: string | null;
  applicationId: number | null;
  entityType: string | null;
  entityId: string | null;
  readAt: string | null;
  archivedAt: string | null;
  createdAt: string;
}

export class NotificationMapper {
  static toDTO(notification: PrismaNotification): NotificationDTO {
    return {
      id: notification.id,
      type: notification.type,
      severity: notification.severity,
      title: notification.title,
      message: notification.message,
      status: notification.status,
      href: notification.href,
      applicationId: notification.applicationId,
      entityType: notification.entityType,
      entityId: notification.entityId,
      readAt: notification.readAt?.toISOString() ?? null,
      archivedAt: notification.archivedAt?.toISOString() ?? null,
      createdAt: notification.createdAt.toISOString(),
    };
  }
}
