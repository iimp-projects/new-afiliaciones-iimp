import { contextService } from "@/modules/auth/context/service";
import { fetchAsociadosAction } from "@/modules/afiliaciones/asociados/Actions/asociados.actions";
import { AsociadosWorkspace } from "@/modules/afiliaciones/asociados/Views/AsociadosWorkspace.tsx"; // Ojo, sin .tsx al final
import { paymentConfig } from "@/modules/afiliaciones/payments/Config/PaymentConfig";

export const metadata = {
  title: "Directorio de Asociados | Intranet IIMP",
};

export default async function AsociadosPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; type?: string; sort?: string; gender?: string; country?: string; university?: string; company?: string; status?: string; from?: string; to?: string; inactivos?: string }>;
}) {
  await contextService.requirePermission("read", "associates");
  const currentUser = await contextService.requireAuth();
  const canReadMemberships = await contextService.hasPermission("read", "memberships");
  const canUpdateAssociateData = await contextService.hasPermission("update", "associates");
  const canReadCards = await contextService.hasPermission("read", "cards");

  const resolvedParams = await searchParams;
  const page = Number(resolvedParams.page) || 1;
  const query = resolvedParams.q || "";
  const membershipType = resolvedParams.type || "ALL";
  const sort = resolvedParams.sort || "desc";

  const { data, total } = await fetchAsociadosAction({
    page,
    pageSize: 8,
    search: query,
    membershipType,
    sort,
    gender: resolvedParams.gender,
    country: resolvedParams.country,
    university: resolvedParams.university,
    company: resolvedParams.company,
    status: resolvedParams.status,
    from: resolvedParams.from,
    to: resolvedParams.to,
    inactivos: resolvedParams.inactivos,
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
        canResetSandboxPayments={paymentConfig.environment === "TEST" && currentUser.role.slug === "SUPER_ADMIN"}
        canReadMemberships={canReadMemberships}
        canUpdateAssociateData={canUpdateAssociateData}
        canReadCards={canReadCards}
      />
    </div>
  );
}
