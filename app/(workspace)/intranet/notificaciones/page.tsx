import { contextService } from "@/modules/auth/context/service";
import { NotificationsCenter } from "@/modules/afiliaciones/notifications/Views/NotificationsCenter";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  await contextService.requireAuth();
  return <NotificationsCenter />;
}
