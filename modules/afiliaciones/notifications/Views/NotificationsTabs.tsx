"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Bell, BellRing } from "lucide-react";
import { NotificationsCenter } from "./NotificationsCenter";
import { OperationalAlertsWorkspace } from "@/modules/afiliaciones/alerts/Views/OperationalAlertsWorkspace";

type Tab = "notifications" | "alerts";

export function NotificationsTabs({ showAlerts }: { showAlerts: boolean }) {
  const searchParams = useSearchParams();
  const initialTab: Tab = searchParams.get("tab") === "alerts" ? "alerts" : "notifications";
  const [tab, setTab] = useState<Tab>(showAlerts ? initialTab : "notifications");

  return (
    <div>
      {showAlerts && (
        <div className="mb-5 flex w-fit rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setTab("notifications")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-colors ${
              tab === "notifications" ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Bell size={15} strokeWidth={2.2} /> Notificaciones
          </button>
          <button
            type="button"
            onClick={() => setTab("alerts")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-colors ${
              tab === "alerts" ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <BellRing size={15} strokeWidth={2.2} /> Alertas
          </button>
        </div>
      )}
      {tab === "notifications" ? <NotificationsCenter /> : <OperationalAlertsWorkspace />}
    </div>
  );
}
