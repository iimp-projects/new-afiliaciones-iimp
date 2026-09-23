import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { contextService } from "@/modules/auth/context/service";
import { MasterDataMergeService } from "@/modules/master-data/Services/MasterDataMergeService";
import type { MasterDataEntity, MasterDataListParams } from "@/modules/master-data/Repositories/MasterDataRepository";
import { masterDataCreateSchema } from "@/modules/master-data/Validation/master-data.schemas";

function entity(value: string): MasterDataEntity {
  if (value === "universities") return "UNIVERSITY";
  if (value === "specialties") return "SPECIALTY";
  if (value === "degrees") return "DEGREE";
  throw new Error("Entidad inválida.");
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ entity: string }> }) {
  try {
    await contextService.requirePermission("read", "catalogs");
    const { entity: raw } = await params;
    const query = request.nextUrl.searchParams;
    const page = Math.max(1, Number(query.get("page") || 1));
    const requestedPageSize = Number(query.get("pageSize"));
    const pageSize = [20, 50, 100].includes(requestedPageSize) ? requestedPageSize : 20;
    const result = await new MasterDataMergeService().list(entity(raw), {
      page,
      pageSize,
      search: query.get("search") || undefined,
      status: (query.get("status") as "ALL" | "ACTIVE" | "INACTIVE") || "ALL",
      studyLevel: query.get("studyLevel") as MasterDataListParams["studyLevel"],
      canonicalOnly: query.get("canonicalOnly") === "true",
      hasReferences: query.get("hasReferences") === "with" || query.get("hasReferences") === "without" ? query.get("hasReferences") as "with" | "without" : undefined,
      countryId: query.get("countryId") ? Number(query.get("countryId")) : undefined,
      categoryId: query.get("categoryId") ? Number(query.get("categoryId")) : undefined,
      sortBy: (query.get("sortBy") as "name" | "references" | "id" | "createdAt") || "name",
      sortOrder: query.get("sortOrder") === "desc" ? "desc" : "asc",
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "No autorizado." }, { status: 403 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ entity: string }> }) {
  try {
    const user = await contextService.getCurrentUser();
    await contextService.requirePermission("create", "catalogs");
    if (!user) return NextResponse.json({ success: false, message: "No autorizado." }, { status: 403 });
    const input = masterDataCreateSchema.parse(await request.json());
    const result = await new MasterDataMergeService().create(entity((await params).entity), { ...input, userId: user.id });
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : error instanceof Error && "status" in error ? Number((error as { status: number }).status) : 400;
    return NextResponse.json({ success: false, message: error instanceof z.ZodError ? "Solicitud inválida." : error instanceof Error ? error.message : "No se pudo crear." }, { status });
  }
}
