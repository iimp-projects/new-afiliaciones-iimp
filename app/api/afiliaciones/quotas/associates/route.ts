import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { apiAuthorizationStatus, requireApiPermission } from "@/modules/auth/context/api-authorization";
import { contextService } from "@/modules/auth/context/service";
import { PrismaQuotaAdminRepository } from "@/modules/afiliaciones/quotas/Repositories/PrismaQuotaAdminRepository";
import { QuotaQueryService } from "@/modules/afiliaciones/quotas/Services/QuotaQueryService";
import { parseQuotaQuery, quotaListQuerySchema } from "@/modules/afiliaciones/quotas/Validators/quotaAdmin.validator";

export async function GET(request: NextRequest) {
  try {
    await requireApiPermission("read", "quotas");
    const query = parseQuotaQuery(quotaListQuerySchema, request.nextUrl.searchParams);
    const canViewDocument = await contextService.hasPermission("read", "associates");
    const service = new QuotaQueryService(new PrismaQuotaAdminRepository());
    const page = await service.listAssociates(query, canViewDocument);
    return NextResponse.json({ success: true, ...page }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ success: false, message: "Parámetros inválidos.", issues: error.issues.map((issue) => ({ path: issue.path, message: issue.message })) }, { status: 400 });
    }
    const status = apiAuthorizationStatus(error);
    console.error("[Quotas Associates API]", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ success: false, message: status < 500 ? "No autorizado." : "No se pudo listar los asociados." }, { status });
  }
}
