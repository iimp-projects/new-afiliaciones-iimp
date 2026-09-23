import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { contextService } from "@/modules/auth/context/service";
import { MasterDataMergeService } from "@/modules/master-data/Services/MasterDataMergeService";
import type { MasterDataEntity } from "@/modules/master-data/Repositories/MasterDataRepository";
import { masterDataUpdateSchema } from "@/modules/master-data/Validation/master-data.schemas";

function parse(raw: string, rawId: string): { entity: MasterDataEntity; id: number } {
  const entity = (raw === "universities" ? "UNIVERSITY" : raw === "specialties" ? "SPECIALTY" : raw === "degrees" ? "DEGREE" : null) as MasterDataEntity | null;
  const id = Number(rawId);
  if (!entity || !Number.isInteger(id) || id <= 0) throw new Error("Identificador inválido.");
  return { entity, id };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ entity: string; id: string }> }) {
  try {
    await contextService.requirePermission("read", "catalogs");
    const raw = await params;
    const target = parse(raw.entity, raw.id);
    const query = request.nextUrl.searchParams;
    const requestedPageSize = Number(query.get("pageSize"));
    return NextResponse.json({ success: true, ...await new MasterDataMergeService().references(target.entity, target.id, Math.max(1, Number(query.get("page") || 1)), [20, 50, 100].includes(requestedPageSize) ? requestedPageSize : 20, query.get("search") || "") });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "No autorizado." }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ entity: string; id: string }> }) {
  try {
    const user = await contextService.getCurrentUser();
    await contextService.requirePermission("update", "catalogs");
    if (!user) return NextResponse.json({ success: false, message: "No autorizado." }, { status: 403 });
    const raw = await params;
    const target = parse(raw.entity, raw.id);
    const input = masterDataUpdateSchema.parse(await request.json());
    const result = await new MasterDataMergeService().update(target.entity, target.id, { ...input, userId: user.id });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : error instanceof Error && "status" in error ? Number((error as { status: number }).status) : 400;
    return NextResponse.json({ success: false, message: error instanceof z.ZodError ? "Solicitud inválida." : error instanceof Error ? error.message : "No se pudo actualizar." }, { status });
  }
}
