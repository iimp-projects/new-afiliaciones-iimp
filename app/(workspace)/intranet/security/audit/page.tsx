import { contextService } from "@/modules/auth/context/service";
import { fetchAuditLogsAction } from "@/modules/security/Audit/Actions/audit.actions";
import { AuditView } from "@/modules/security/Audit/Views/AuditView";

export const metadata = { title: "Auditoría | Intranet IIMP" };

export default async function AuditPage() {
  await contextService.requirePermission("read", "audit");
  const { data: logs, total } = await fetchAuditLogsAction();

  return <AuditView logs={logs} total={total} />;
}