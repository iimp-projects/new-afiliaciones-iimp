import { Suspense } from "react";
import { contextService } from "@/modules/auth/context/service";
import { QuotasWorkspace } from "@/modules/afiliaciones/quotas/Views/QuotasWorkspace";

export const metadata = {
  title: "Cuotas | Intranet IIMP",
};

export default async function CuotasPage() {
  await contextService.requirePermission("read", "quotas");
  const canExport = await contextService.hasPermission("export", "quotas");

  return (
    <div className="h-full">
      <Suspense fallback={<div className="space-y-4"><div className="h-28 animate-pulse rounded-2xl bg-white" /><div className="h-72 animate-pulse rounded-2xl bg-white" /></div>}>
        <QuotasWorkspace canExport={canExport} />
      </Suspense>
    </div>
  );
}
