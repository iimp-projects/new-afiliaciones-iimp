import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { apiAuthorizationStatus, requireApiPermission } from "@/modules/auth/context/api-authorization";
import { contextService } from "@/modules/auth/context/service";
import { PrismaQuotaAdminRepository } from "@/modules/afiliaciones/quotas/Repositories/PrismaQuotaAdminRepository";
import { QuotaHistoryService } from "@/modules/afiliaciones/quotas/Services/QuotaHistoryService";
import { parseQuotaQuery, quotaHistoryQuerySchema } from "@/modules/afiliaciones/quotas/Validators/quotaAdmin.validator";

export async function GET(request: NextRequest) {
  try {
    await requireApiPermission("read", "quotas");
    const query = parseQuotaQuery(quotaHistoryQuerySchema, request.nextUrl.searchParams);
    const canViewDocument = await contextService.hasPermission("read", "associates");
    const service = new QuotaHistoryService(new PrismaQuotaAdminRepository());
    const page = await service.list({ ...query, personId: query.personId, includeAbsent: query.includeAbsent }, canViewDocument);
    return NextResponse.json({ success: true, ...page }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ success: false, message: "Parámetros inválidos.", issues: error.issues.map((issue) => ({ path: issue.path, message: issue.message })) }, { status: 400 });
    }
    const status = apiAuthorizationStatus(error);
    console.error("[Quotas History API]", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ success: false, message: status < 500 ? "No autorizado." : "No se pudo listar el histórico." }, { status });
  }
}
