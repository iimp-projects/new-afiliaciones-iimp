import { contextService } from "@/modules/auth/context/service";
import { fetchAsociadosAction } from "@/modules/afiliaciones/asociados/Actions/asociados.actions";
import { AsociadosWorkspace } from "@/modules/afiliaciones/asociados/Views/AsociadosWorkspace.tsx"; // Ojo, sin .tsx al final

export const metadata = {
  title: "Directorio de Asociados | Intranet IIMP",
};

export default async function AsociadosPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; type?: string; sort?: string }>;
}) {
  await contextService.requirePermission("read", "memberships");

  const resolvedParams = await searchParams;
  const page = Number(resolvedParams.page) || 1;
  const query = resolvedParams.q || "";
  const membershipType = resolvedParams.type || "ALL";
  const sort = resolvedParams.sort || "desc";

  const { data, total } = await fetchAsociadosAction({
    page,
    pageSize: 12,
    search: query,
    membershipType,
    sort,
  });

  return (
    <div className="h-full">
      <AsociadosWorkspace
        initialData={data || []}
        total={total || 0}
        currentPage={page}
        query={query}
        membershipType={membershipType}
        sort={sort}
      />
    </div>
  );
}