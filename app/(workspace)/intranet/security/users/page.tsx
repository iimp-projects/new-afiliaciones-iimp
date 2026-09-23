import { contextService } from "@/modules/auth/context/service";
import { UsersView } from "@/modules/security/Users/Views/UsersView";
import { prisma } from "@/lib/prisma"; // Para obtener roles r pidamente en lectura

export const metadata = {
  title: "Gesti n de Usuarios | Intranet IIMP",
};

export default async function UsuariosPage() {
  // 1. Proteger ruta
  await contextService.requirePermission("read", "users");

  // 2. Obtener roles activos para el formulario de creaci n
  const roles = await prisma.role.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" }
  });

  return (
    <div className="h-full">
      <UsersView 
        roles={roles} 
      />
    </div>
  );
}
