import { NextRequest, NextResponse } from "next/server";
import { NotificationStatus } from "@prisma/client";
import { NotificationService } from "@/modules/afiliaciones/notifications/Services/NotificationService";
import { requireNotificationIdentity } from "@/modules/afiliaciones/notifications/Api/notificationIdentity";

const statuses = new Set(Object.values(NotificationStatus));

export async function GET(request: NextRequest) {
  try {
    const user = await requireNotificationIdentity();
    if (!user) return NextResponse.json({ message: "No autenticado." }, { status: 401 });

    const params = request.nextUrl.searchParams;
    const statusParam = params.get("status");
    const type = params.get("type") || undefined;
    const cursorParam = params.get("cursor");
    const limitParam = params.get("limit");

    if (statusParam && !statuses.has(statusParam as NotificationStatus)) {
      return NextResponse.json({ message: "status inválido." }, { status: 422 });
    }

    const cursor = cursorParam ? Number(cursorParam) : undefined;
    if (cursorParam && (!Number.isInteger(cursor) || (cursor as number) < 1)) {
      return NextResponse.json({ message: "cursor inválido." }, { status: 422 });
    }
    const limit = limitParam ? Number(limitParam) : undefined;
    if (limitParam && (!Number.isInteger(limit) || (limit as number) < 1)) {
      return NextResponse.json({ message: "limit inválido." }, { status: 422 });
    }

    const service = new NotificationService();
    const result = await service.list(user.id, {
      status: statusParam as NotificationStatus | undefined,
      type,
      cursor: cursor as number | undefined,
      limit: limit as number | undefined,
    });

    return NextResponse.json(
      { success: true, data: result.items, meta: { nextCursor: result.nextCursor } },
      { status: 200 },
    );
  } catch (error) {
    console.error("[NOTIFICATIONS_LIST_ERROR]", error);
    return NextResponse.json({ success: false, message: "No fue posible consultar las notificaciones." }, { status: 500 });
  }
}
