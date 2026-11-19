import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { apiAuthorizationStatus, requireApiPermission } from "@/modules/auth/context/api-authorization";
import { PrismaQuotaAdminRepository } from "@/modules/afiliaciones/quotas/Repositories/PrismaQuotaAdminRepository";
import { QuotaSyncHistoryService } from "@/modules/afiliaciones/quotas/Services/QuotaSyncHistoryService";
import { parseQuotaQuery, quotaSyncRunsQuerySchema } from "@/modules/afiliaciones/quotas/Validators/quotaAdmin.validator";

export async function GET(request: NextRequest) {
  try {
    await requireApiPermission("read", "quotas");
    const query = parseQuotaQuery(quotaSyncRunsQuerySchema, request.nextUrl.searchParams);
    const service = new QuotaSyncHistoryService(new PrismaQuotaAdminRepository());
    const page = await service.listRuns(query.page, query.pageSize);
    return NextResponse.json({ success: true, ...page }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ success: false, message: "Parámetros inválidos." }, { status: 400 });
    }
    const status = apiAuthorizationStatus(error);
    console.error("[Quotas SyncRuns API]", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ success: false, message: status < 500 ? "No autorizado." : "No se pudo listar las sincronizaciones." }, { status });
  }
}
