import { contextService } from "@/modules/auth/context/service";
import { fetchAuditLogsAction } from "@/modules/security/Audit/Actions/audit.actions";
import { SystemSettingsView } from "@/modules/security/system-settings/Views/SystemSettingsView";

export const metadata = { title: "Configuración de pagos | Intranet IIMP" };

export default async function SystemSettingsPage() {
  await contextService.requireRole(["SUPER_ADMIN"]);
  const audit = await fetchAuditLogsAction(1, 100);
  const settingAuditLogs = audit.data.filter((log) => log.entity === "SystemSettingValue");
  return <SystemSettingsView initialAuditLogs={settingAuditLogs} />;
}
