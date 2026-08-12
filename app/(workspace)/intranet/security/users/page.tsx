import { contextService } from "@/modules/auth/context/service";
import { fetchUsersAction } from "@/modules/security/Users/Actions/user.actions";
import { UsersView } from "@/modules/security/Users/Views/UsersView";
import { prisma } from "@/lib/prisma"; // Para obtener roles r pidamente en lectura

export const metadata = {
  title: "Gesti n de Usuarios | Intranet IIMP",
};

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  // 1. Proteger ruta
  await contextService.requirePermission("read", "users");

  // 2. Resolver par metros (Next.js 15+ requiere await para searchParams)
  const resolvedParams = await searchParams;
  const page = Number(resolvedParams.page) || 1;
  const query = resolvedParams.q || "";

  // 3. Obtener data desde el Server Action que creamos
  const { data: users, total } = await fetchUsersAction(page, 10, query);

  // 4. Obtener roles activos para el formulario de creaci n
  const roles = await prisma.role.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" }
  });

  return (
    <div className="h-full">
      <UsersView 
        initialUsers={users} 
        total={total} 
        currentPage={page} 
        query={query} 
        roles={roles} 
      />
    </div>
  );
}