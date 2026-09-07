import { NextResponse } from "next/server";
import { contextService } from "@/modules/auth/context/service";
import { MasterDataMergeService } from "@/modules/master-data/Services/MasterDataMergeService";
import type { MasterDataEntity } from "@/modules/master-data/Repositories/MasterDataRepository";

export async function POST(request: Request) {
  try {
    const user = await contextService.getCurrentUser();
    await contextService.requirePermission("update", "catalogs");
    if (!user) return NextResponse.json({ success: false, message: "No autorizado." }, { status: 403 });
    const body = await request.json() as { entityType?: string; selectedIds?: unknown };
    const entity = body.entityType === "UNIVERSITY" || body.entityType === "SPECIALTY" || body.entityType === "DEGREE" ? body.entityType as MasterDataEntity : null;
    if (!entity || !Array.isArray(body.selectedIds) || body.selectedIds.some((id) => typeof id !== "number")) return NextResponse.json({ success: false, message: "Entidad o selección inválida." }, { status: 400 });
    const result = await new MasterDataMergeService().bulkDeactivate({ entity, selectedIds: body.selectedIds as number[], userId: user.id });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const status = error instanceof Error && "status" in error ? Number((error as { status: number }).status) : 400;
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "No se pudo desactivar." }, { status });
  }
}
