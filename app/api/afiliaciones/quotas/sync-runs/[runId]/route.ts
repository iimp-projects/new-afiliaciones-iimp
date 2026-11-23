import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { apiAuthorizationStatus, requireApiPermission } from "@/modules/auth/context/api-authorization";
import { PrismaQuotaAdminRepository } from "@/modules/afiliaciones/quotas/Repositories/PrismaQuotaAdminRepository";
import { QuotaSyncHistoryService } from "@/modules/afiliaciones/quotas/Services/QuotaSyncHistoryService";
import { parseQuotaQuery, quotaSyncRunDetailQuerySchema } from "@/modules/afiliaciones/quotas/Validators/quotaAdmin.validator";

export async function GET(request: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  try {
    await requireApiPermission("read", "quotas");
    const runId = Number((await params).runId);
    if (!Number.isInteger(runId) || runId < 1) return NextResponse.json({ success: false, message: "Identificador inválido." }, { status: 400 });
    const query = parseQuotaQuery(quotaSyncRunDetailQuerySchema, request.nextUrl.searchParams);
    const service = new QuotaSyncHistoryService(new PrismaQuotaAdminRepository());
    const run = await service.getRun(runId);
    if (!run) return NextResponse.json({ success: false, message: "Ejecución no encontrada." }, { status: 404 });
    const items = await service.listRunItems(runId, query.page, query.pageSize);
    return NextResponse.json({ success: true, data: { run, items } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ZodError) return NextResponse.json({ success: false, message: "Parámetros inválidos." }, { status: 400 });
    const status = apiAuthorizationStatus(error);
    console.error("[Quotas SyncRun Detail API]", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ success: false, message: status < 500 ? "No autorizado." : "No se pudo obtener la ejecución." }, { status });
  }
}
