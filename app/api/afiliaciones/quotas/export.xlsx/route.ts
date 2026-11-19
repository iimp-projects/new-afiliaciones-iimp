import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { apiAuthorizationStatus, requireApiPermission } from "@/modules/auth/context/api-authorization";
import { contextService } from "@/modules/auth/context/service";
import { PrismaQuotaAdminRepository } from "@/modules/afiliaciones/quotas/Repositories/PrismaQuotaAdminRepository";
import { QuotaDashboardService } from "@/modules/afiliaciones/quotas/Services/QuotaDashboardService";
import { QuotaExportService } from "@/modules/afiliaciones/quotas/Services/QuotaExportService";
import { QuotaHistoryService } from "@/modules/afiliaciones/quotas/Services/QuotaHistoryService";
import { QuotaIncidenceService } from "@/modules/afiliaciones/quotas/Services/QuotaIncidenceService";
import { QuotaQueryService } from "@/modules/afiliaciones/quotas/Services/QuotaQueryService";
import type { QuotaAdminFilters } from "@/modules/afiliaciones/quotas/Models/QuotaAdmin";
import { parseQuotaQuery, quotaExportQuerySchema } from "@/modules/afiliaciones/quotas/Validators/quotaAdmin.validator";

export async function GET(request: NextRequest) {
  try {
    const user = await requireApiPermission("export", "quotas");
    const query = parseQuotaQuery(quotaExportQuerySchema, request.nextUrl.searchParams);
    const { type, code, status, ...rest } = query;
    const filters: QuotaAdminFilters = { ...rest, page: 1, pageSize: 100, errorCode: code, incidenceStatus: status };
    const canViewDocument = await contextService.hasPermission("read", "associates");
    const repository = new PrismaQuotaAdminRepository();
    const service = new QuotaExportService(
      new QuotaDashboardService(repository),
      new QuotaQueryService(repository),
      new QuotaHistoryService(repository),
      new QuotaIncidenceService(repository),
    );
    const result = await service.build({ type, filters, canViewDocument, actorUserId: user.id });
    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
        "Cache-Control": "no-store",
        "X-Export-Rows": String(result.rowCount),
        "X-Export-Truncated": String(result.truncated),
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ success: false, message: "Parámetros inválidos.", issues: error.issues.map((issue) => ({ path: issue.path, message: issue.message })) }, { status: 400 });
    }
    const status = apiAuthorizationStatus(error);
    console.error("[Quotas Export API]", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ success: false, message: status < 500 ? "No autorizado." : "No se pudo generar la exportación." }, { status });
  }
}
