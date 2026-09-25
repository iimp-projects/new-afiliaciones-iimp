import { contextService } from "@/modules/auth/context/service";
import { OperationalAlertsWorkspace } from "@/modules/afiliaciones/alerts/Views/OperationalAlertsWorkspace";

export const metadata = { title: "Centro de alertas | Intranet IIMP" };

export default async function AlertsPage() {
  await contextService.requirePermission("read", "alerts");
  return <OperationalAlertsWorkspace />;
}
