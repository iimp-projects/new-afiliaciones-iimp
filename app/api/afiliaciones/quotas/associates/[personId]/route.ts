import { NextResponse } from "next/server";
import { apiAuthorizationStatus, requireApiPermission } from "@/modules/auth/context/api-authorization";
import { contextService } from "@/modules/auth/context/service";
import { PrismaQuotaAdminRepository } from "@/modules/afiliaciones/quotas/Repositories/PrismaQuotaAdminRepository";
import { QuotaQueryService } from "@/modules/afiliaciones/quotas/Services/QuotaQueryService";

export async function GET(_: Request, { params }: { params: Promise<{ personId: string }> }) {
  try {
    await requireApiPermission("read", "quotas");
    const personId = Number((await params).personId);
    if (!Number.isInteger(personId) || personId < 1) {
      return NextResponse.json({ success: false, message: "Identificador inválido." }, { status: 400 });
    }
    const canViewDocument = await contextService.hasPermission("read", "associates");
    const service = new QuotaQueryService(new PrismaQuotaAdminRepository());
    const data = await service.getAssociateDetail(personId, canViewDocument);
    if (!data) return NextResponse.json({ success: false, message: "Asociado no encontrado." }, { status: 404 });
    return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = apiAuthorizationStatus(error);
    console.error("[Quotas Detail API]", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ success: false, message: status < 500 ? "No autorizado." : "No se pudo obtener el detalle." }, { status });
  }
}
