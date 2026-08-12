import { contextService } from "@/modules/auth/context/service";
import { fetchRolesAction } from "@/modules/security/Roles/Actions/role.actions";
import { RolesView } from "@/modules/security/Roles/Views/RolesView";

export const metadata = { title: "Roles y Permisos | Intranet IIMP" };

export default async function RolesPage() {
  await contextService.requirePermission("read", "roles");
  const { data: roles, total } = await fetchRolesAction();

  return <RolesView initialRoles={roles} total={total} />;
}