import { NextRequest, NextResponse } from "next/server";
import { NotificationService, NotificationError } from "@/modules/afiliaciones/notifications/Services/NotificationService";
import { requireNotificationIdentity } from "@/modules/afiliaciones/notifications/Api/notificationIdentity";

export async function PATCH(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireNotificationIdentity();
    if (!user) return NextResponse.json({ message: "No autenticado." }, { status: 401 });

    const { id } = await params;
    const notificationId = Number(id);
    if (!Number.isInteger(notificationId) || notificationId < 1) {
      return NextResponse.json({ message: "Notificación inválida." }, { status: 400 });
    }

    await new NotificationService().archive(user.id, notificationId);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    if (error instanceof NotificationError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    console.error("[NOTIFICATIONS_ARCHIVE_ERROR]", error);
    return NextResponse.json({ success: false, message: "No fue posible archivar la notificación." }, { status: 500 });
  }
}
