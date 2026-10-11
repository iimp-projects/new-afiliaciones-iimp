"use client";
/* eslint-disable react-hooks/set-state-in-effect -- la carga inicial se dispara explícitamente al montar y al cambiar de pestaña. */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Bell, CheckCheck, Inbox, RefreshCw } from "lucide-react";
import type { NotificationDTO } from "../Mappers/NotificationMapper";
import { notificationsApi } from "../Api/NotificationsApi";
import { getNotificationPresentation, getNotificationSeverityLabel } from "../Types/NotificationTypes";

type Tab = "ALL" | "UNREAD" | "ARCHIVED";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "UNREAD", label: "No leídas" },
  { id: "ALL", label: "Todas" },
  { id: "ARCHIVED", label: "Archivadas" },
];

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Ahora";
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Hace ${days} d`;
  return date.toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
}

function broadcastNotificationsChange(): void {
  window.dispatchEvent(new Event("notifications-changed"));
}

export function NotificationsCenter() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("UNREAD");
  const [items, setItems] = useState<NotificationDTO[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [unread, setUnread] = useState(0);
  const requestIdRef = useRef(0);

  const statusParam = tab === "ARCHIVED" ? "ARCHIVED" : tab === "UNREAD" ? "UNREAD" : undefined;

  const load = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(false);
    try {
      const [result, count] = await Promise.all([
        notificationsApi.list({ status: statusParam, limit: 20 }),
        notificationsApi.unreadCount(),
      ]);
      if (requestId !== requestIdRef.current) return;
      setItems(result.data);
      setNextCursor(result.meta.nextCursor);
      setUnread(count);
    } catch {
      if (requestId === requestIdRef.current) setError(true);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [statusParam]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = useCallback(async () => {
    if (nextCursor === null || loadingMore) return;
    setLoadingMore(true);
    try {
      const result = await notificationsApi.list({ status: statusParam, cursor: nextCursor, limit: 20 });
      setItems((prev) => [...prev, ...result.data]);
      setNextCursor(result.meta.nextCursor);
    } catch {
      // Conserva lo ya cargado; el usuario puede reintentar con el botón.
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore, statusParam]);

  const markRead = useCallback(
    async (notification: NotificationDTO) => {
      if (notification.status !== "UNREAD") {
        if (notification.href) router.push(notification.href);
        return;
      }
      setItems((prev) => prev.map((item) => (item.id === notification.id ? { ...item, status: "READ" as const, readAt: new Date().toISOString() } : item)));
      setUnread((prev) => Math.max(0, prev - 1));
      try {
        await notificationsApi.markRead(notification.id);
        broadcastNotificationsChange();
      } catch {
        void load();
      }
      if (notification.href) router.push(notification.href);
    },
    [load, router],
  );

  const markAllRead = useCallback(async () => {
    try {
      await notificationsApi.markAllRead();
      setUnread(0);
      await load();
      broadcastNotificationsChange();
    } catch {
      // Reintenta en la próxima interacción.
    }
  }, [load]);

  const archive = useCallback(
    async (notification: NotificationDTO) => {
      setItems((prev) => prev.filter((item) => item.id !== notification.id));
      if (notification.status === "UNREAD") setUnread((prev) => Math.max(0, prev - 1));
      try {
        await notificationsApi.archive(notification.id);
        broadcastNotificationsChange();
      } catch {
        void load();
      }
    },
    [load],
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-800">Centro de Notificaciones</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            {unread > 0 ? `Tienes ${unread} notificaci${unread === 1 ? "ón" : "ones"} sin leer.` : "Estás al día."}
          </p>
        </div>
        <button
          onClick={() => void markAllRead()}
          disabled={unread === 0}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 transition-colors hover:border-[#c39254] hover:text-[#7f561e] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CheckCheck size={16} strokeWidth={2.5} />
          Marcar todas como leídas
        </button>
      </div>

      <div className="mb-4 flex gap-1 rounded-xl bg-slate-100 p-1">
        {TABS.map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold transition-colors ${
              tab === item.id ? "bg-white text-[#7f561e] shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {item.label}
            {item.id === "UNREAD" && unread > 0 ? ` (${unread})` : ""}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
        {loading && (
          <div className="space-y-3 p-5">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="flex gap-4 animate-pulse">
                <div className="h-10 w-10 shrink-0 rounded-full bg-slate-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-1/2 rounded bg-slate-100" />
                  <div className="h-3 w-full rounded bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="flex flex-col items-center gap-3 p-10 text-center">
            <p className="text-sm font-bold text-slate-500">No fue posible cargar las notificaciones.</p>
            <button
              onClick={() => void load()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-[#7f561e] hover:border-[#c39254]"
            >
              <RefreshCw size={16} />
              Reintentar
            </button>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="flex flex-col items-center gap-3 p-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-50">
              <Inbox size={22} className="text-[#c39254]" strokeWidth={2.2} />
            </div>
            <p className="text-sm font-bold text-slate-600">No tienes notificaciones aquí.</p>
            <p className="text-xs font-medium text-slate-400">Las novedades de tus expedientes aparecerán en esta bandeja.</p>
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <ul className="divide-y divide-slate-50">
            {items.map((notification) => {
              const presentation = getNotificationPresentation(notification.type);
              return (
                <li key={notification.id} className={`group flex items-start gap-4 p-4 transition-colors hover:bg-[#fffdf8] ${notification.status === "UNREAD" ? "bg-orange-50/40" : ""}`}>
                  <button
                    onClick={() => void markRead(notification)}
                    className="flex flex-1 items-start gap-4 text-left"
                    aria-label={notification.status === "UNREAD" ? "Marcar como leída" : "Abrir notificación"}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-orange-100 bg-orange-50">
                      <Bell size={18} className="text-[#c39254]" strokeWidth={2.2} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className={`text-sm font-extrabold ${notification.status === "UNREAD" ? "text-slate-800" : "text-slate-600"}`}>
                          {notification.title || presentation.label}
                        </h3>
                        {notification.status === "UNREAD" && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#c39254]" />}
                      </div>
                      <p className="mt-0.5 text-[13px] font-medium leading-snug text-slate-500">{notification.message}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-bold text-slate-400">
                        <span>{formatRelativeTime(notification.createdAt)}</span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{getNotificationSeverityLabel(notification.severity)}</span>
                        <span className="px-1.5 py-0.5 rounded bg-orange-50 text-[#7f561e]">{presentation.label}</span>
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => void archive(notification)}
                    className="rounded-lg p-2 text-slate-300 transition-colors hover:bg-slate-100 hover:text-slate-500"
                    aria-label="Archivar notificación"
                  >
                    <Archive size={16} strokeWidth={2.2} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {!loading && !error && nextCursor !== null && (
          <div className="border-t border-slate-100 p-3 text-center">
            <button
              onClick={() => void loadMore()}
              disabled={loadingMore}
              className="text-sm font-bold text-[#7f561e] hover:text-[#c39254] disabled:opacity-50"
            >
              {loadingMore ? "Cargando…" : "Cargar más"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
