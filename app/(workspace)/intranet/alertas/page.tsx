import { redirect } from "next/navigation";
import { contextService } from "@/modules/auth/context/service";

export const metadata = { title: "Centro de alertas | Intranet IIMP" };

export default async function AlertsPage({ searchParams }: { searchParams: Promise<{ applicationId?: string }> }) {
  await contextService.requirePermission("read", "alerts");
  const { applicationId } = await searchParams;
  const target = `/intranet/notificaciones?tab=alerts${applicationId ? `&applicationId=${encodeURIComponent(applicationId)}` : ""}`;
  redirect(target);
}
