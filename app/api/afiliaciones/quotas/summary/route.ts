import { NextResponse } from "next/server";
import { apiAuthorizationStatus, requireApiPermission } from "@/modules/auth/context/api-authorization";
import { PrismaQuotaAdminRepository } from "@/modules/afiliaciones/quotas/Repositories/PrismaQuotaAdminRepository";
import { QuotaDashboardService } from "@/modules/afiliaciones/quotas/Services/QuotaDashboardService";

export async function GET() {
  try {
    await requireApiPermission("read", "quotas");
    const service = new QuotaDashboardService(new PrismaQuotaAdminRepository());
    const data = await service.getSummary();
    return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = apiAuthorizationStatus(error);
    console.error("[Quotas Summary API]", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ success: false, message: status < 500 ? "No autorizado." : "No se pudo obtener el resumen de cuotas." }, { status });
  }
}
