import { NextResponse } from "next/server";
import { contextService } from "@/modules/auth/context/service";
import { MasterDataMergeService } from "@/modules/master-data/Services/MasterDataMergeService";
export async function GET() { try { await contextService.requirePermission("read", "catalogs"); return NextResponse.json({ success: true, data: await new MasterDataMergeService().listCategories() }); } catch (error) { return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "No autorizado." }, { status: 403 }); } }
