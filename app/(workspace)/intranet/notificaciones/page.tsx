import { contextService } from "@/modules/auth/context/service";
import { NotificationsTabs } from "@/modules/afiliaciones/notifications/Views/NotificationsTabs";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  await contextService.requireAuth();
  const showAlerts = await contextService.hasPermission("read", "alerts");
  return <NotificationsTabs showAlerts={showAlerts} />;
}
