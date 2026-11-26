import { contextService } from "@/modules/auth/context/service";
import { AccessControlWorkspace } from "@/modules/afiliaciones/control-accesos/Views/AccessControlWorkspace";

export const metadata = {
  title: "Control de accesos | Intranet IIMP",
};

export default async function ControlAccesosPage() {
  await contextService.requirePermission("read", "access_control");
  const [canOperate, canManage, canExport] = await Promise.all([
    contextService.hasPermission("operate", "access_control"),
    contextService.hasPermission("manage", "access_control"),
    contextService.hasPermission("export", "access_control"),
  ]);
  return <AccessControlWorkspace canOperate={canOperate} canManage={canManage} canExport={canExport} />;
}
