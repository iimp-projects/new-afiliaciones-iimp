import { contextService } from "@/modules/auth/context/service";
import { UsersView } from "@/modules/security/Users/Views/UsersView";
import { canAssignPrivilegedRoles } from "@/modules/security/Users/Policies/UserRoleAssignmentPolicy";
import { prisma } from "@/lib/prisma"; // Para obtener roles r pidamente en lectura

export const metadata = {
  title: "Gesti n de Usuarios | Intranet IIMP",
};

export default async function UsuariosPage() {
  // 1. Proteger ruta
  const operator = await contextService.requirePermission("read", "users");

  // 2. Obtener roles activos para el formulario de creaci n
  const roles = await prisma.role.findMany({
    where: { isActive: true },
    select: { id: true, name: true, slug: true },
    orderBy: { name: "asc" }
  });

  return (
    <div className="h-full">
      <UsersView 
        roles={roles} 
        canAssignPrivilegedRoles={canAssignPrivilegedRoles(operator)}
      />
    </div>
  );
}
