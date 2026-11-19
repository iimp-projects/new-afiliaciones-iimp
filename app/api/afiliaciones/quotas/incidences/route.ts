import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { apiAuthorizationStatus, requireApiPermission } from "@/modules/auth/context/api-authorization";
import { PrismaQuotaAdminRepository } from "@/modules/afiliaciones/quotas/Repositories/PrismaQuotaAdminRepository";
import { QuotaIncidenceService } from "@/modules/afiliaciones/quotas/Services/QuotaIncidenceService";
import { parseQuotaQuery, quotaIncidencesQuerySchema } from "@/modules/afiliaciones/quotas/Validators/quotaAdmin.validator";

export async function GET(request: NextRequest) {
  try {
    await requireApiPermission("read", "quotas");
    const query = parseQuotaQuery(quotaIncidencesQuerySchema, request.nextUrl.searchParams);
    const service = new QuotaIncidenceService(new PrismaQuotaAdminRepository());
    const page = await service.list({
      page: query.page,
      pageSize: query.pageSize,
      concept: "CUOTA",
      sort: "name",
      direction: "asc",
      errorCode: query.code,
      incidenceStatus: query.status,
      includeResolved: query.includeResolved,
      resolvedOnly: query.resolvedOnly,
    });
    return NextResponse.json({ success: true, ...page }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ success: false, message: "Parámetros inválidos.", issues: error.issues.map((issue) => ({ path: issue.path, message: issue.message })) }, { status: 400 });
    }
    const status = apiAuthorizationStatus(error);
    console.error("[Quotas Incidences API]", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ success: false, message: status < 500 ? "No autorizado." : "No se pudieron obtener las incidencias." }, { status });
  }
}
