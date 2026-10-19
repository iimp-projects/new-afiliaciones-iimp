import { NextResponse } from "next/server";
import { NotificationService } from "@/modules/afiliaciones/notifications/Services/NotificationService";
import { requireNotificationIdentity } from "@/modules/afiliaciones/notifications/Api/notificationIdentity";

export async function GET() {
  try {
    const user = await requireNotificationIdentity();
    if (!user) return NextResponse.json({ message: "No autenticado." }, { status: 401 });

    const count = await new NotificationService().unreadCount(user.id);
    return NextResponse.json({ success: true, count }, { status: 200 });
  } catch (error) {
    console.error("[NOTIFICATIONS_UNREAD_COUNT_ERROR]", error);
    return NextResponse.json({ success: false, message: "No fue posible consultar el contador." }, { status: 500 });
  }
}
