import { NextRequest, NextResponse } from "next/server";
import { contextService } from "@/modules/auth/context/service";
import { MasterDataMergeService } from "@/modules/master-data/Services/MasterDataMergeService";
import type { MasterDataEntity } from "@/modules/master-data/Repositories/MasterDataRepository";
export async function POST(request: NextRequest) { try { await contextService.requirePermission("merge", "catalogs"); const body = await request.json() as { entity: MasterDataEntity; selectedIds: number[]; canonicalId: number }; const preview = await new MasterDataMergeService().preview(body); return NextResponse.json({ success: true, data: preview }); } catch (error) { const status = error instanceof Error && "status" in error ? Number((error as { status: number }).status) : 400; return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Solicitud inválida." }, { status }); } }
