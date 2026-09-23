import { NextRequest, NextResponse } from "next/server";
import { contextService } from "@/modules/auth/context/service";
import { AssociatesIntegrationService } from "@/modules/afiliaciones/associates-integration/Services/AssociatesIntegrationService";

export async function GET(request: NextRequest) {
  try {
    const user = await contextService.getCurrentUser();
    if (!user) return NextResponse.json({ success: false, message: "No autenticado." }, { status: 401 });
    await contextService.requireRole(["SUPER_ADMIN"]);
    const query = request.nextUrl.searchParams;
    const page = Math.max(1, Number(query.get("page") || 1));
    const pageSize = Math.min(100, Math.max(1, Number(query.get("pageSize") || 20)));
    const result = await new AssociatesIntegrationService().listAdmin({ page, pageSize, status: query.get("status") as never || undefined, trigger: query.get("trigger") as never || undefined, affiliateType: query.get("affiliateType") as never || undefined, search: query.get("search") || undefined, from: query.get("dateFrom") ? new Date(query.get("dateFrom")!) : undefined, to: query.get("dateTo") ? new Date(query.get("dateTo")!) : undefined });
    return NextResponse.json({ success: true, data: result.data, pagination: { page, pageSize, total: result.total } });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Error administrativo." }, { status: 403 });
  }
}
