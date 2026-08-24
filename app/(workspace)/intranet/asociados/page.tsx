import { contextService } from "@/modules/auth/context/service";
import { fetchAsociadosAction } from "@/modules/afiliaciones/asociados/Actions/asociados.actions";
import { AsociadosWorkspace } from "@/modules/afiliaciones/asociados/Views/AsociadosWorkspace.tsx";

export const metadata = {
  title: "Directorio de Asociados | Intranet IIMP",
};

export default async function AsociadosPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; type?: string }>;
}) {
  // 1. Validar permiso de seguridad
  await contextService.requirePermission("read", "memberships");

  // 2. Resolver parámetros de búsqueda y paginación
  const resolvedParams = await searchParams;
  const page = Number(resolvedParams.page) || 1;
  const query = resolvedParams.q || "";
  const membershipType = resolvedParams.type || "ALL";

  // 3. Ejecutar la acción contra la base de datos (Traemos 12 por página para que el Grid 4x3 sea perfecto)
  const { data, total } = await fetchAsociadosAction({
    page,
    pageSize: 12,
    search: query,
    membershipType,
  });

  return (
    <div className="h-full">
      <AsociadosWorkspace
        initialData={data || []}
        total={total || 0}
        currentPage={page}
        query={query}
        membershipType={membershipType}
      />
    </div>
  );
}