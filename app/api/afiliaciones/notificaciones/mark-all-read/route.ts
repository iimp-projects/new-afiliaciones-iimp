import { NextResponse } from "next/server";
import { NotificationService } from "@/modules/afiliaciones/notifications/Services/NotificationService";
import { requireNotificationIdentity } from "@/modules/afiliaciones/notifications/Api/notificationIdentity";

export async function POST() {
  try {
    const user = await requireNotificationIdentity();
    if (!user) return NextResponse.json({ message: "No autenticado." }, { status: 401 });

    const updated = await new NotificationService().markAllRead(user.id);
    return NextResponse.json({ success: true, updated }, { status: 200 });
  } catch (error) {
    console.error("[NOTIFICATIONS_MARK_ALL_READ_ERROR]", error);
    return NextResponse.json({ success: false, message: "No fue posible actualizar las notificaciones." }, { status: 500 });
  }
}
