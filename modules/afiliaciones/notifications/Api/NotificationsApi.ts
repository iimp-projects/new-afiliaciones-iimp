"use client";
import type { NotificationDTO } from "../Mappers/NotificationMapper";

export interface NotificationListResponse {
  success: boolean;
  data: NotificationDTO[];
  meta: { nextCursor: number | null };
}

export interface ListNotificationsParams {
  status?: string;
  type?: string;
  cursor?: number;
  limit?: number;
}

export class NotificationsApi {
  async list(params: ListNotificationsParams = {}): Promise<NotificationListResponse> {
    const search = new URLSearchParams();
    if (params.status) search.set("status", params.status);
    if (params.type) search.set("type", params.type);
    if (params.cursor) search.set("cursor", String(params.cursor));
    if (params.limit) search.set("limit", String(params.limit));

    const response = await fetch(`/api/afiliaciones/notificaciones?${search.toString()}`, { cache: "no-store" });
    if (!response.ok) throw new Error("NOTIFICATIONS_FETCH_ERROR");
    return response.json();
  }

  async unreadCount(): Promise<number> {
    const response = await fetch("/api/afiliaciones/notificaciones/unread-count", { cache: "no-store" });
    if (!response.ok) throw new Error("NOTIFICATIONS_COUNT_ERROR");
    const body = (await response.json()) as { count: number };
    return body.count;
  }

  async markRead(id: number): Promise<void> {
    await this.patch(`/api/afiliaciones/notificaciones/${id}`);
  }

  async archive(id: number): Promise<void> {
    await this.patch(`/api/afiliaciones/notificaciones/${id}/archive`);
  }

  async markAllRead(): Promise<void> {
    const response = await fetch("/api/afiliaciones/notificaciones/mark-all-read", { method: "POST" });
    if (!response.ok) throw new Error("NOTIFICATIONS_MARK_ALL_ERROR");
  }

  private async patch(url: string): Promise<void> {
    const response = await fetch(url, { method: "PATCH" });
    if (!response.ok) throw new Error("NOTIFICATIONS_PATCH_ERROR");
  }
}

export const notificationsApi = new NotificationsApi();
