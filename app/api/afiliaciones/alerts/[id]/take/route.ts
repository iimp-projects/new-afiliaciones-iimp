import { NextResponse } from "next/server";
import { operationalAlertManagementService } from "@/modules/afiliaciones/alerts/Services/OperationalAlertManagementService";
import { contextService } from "@/modules/auth/context/service";
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) { try { const actor = await contextService.requireAuth(); await contextService.requirePermission("update", "alerts"); return NextResponse.json(await operationalAlertManagementService.takeAlert(Number((await params).id), actor.id)); } catch (error) { return NextResponse.json({ message: error instanceof Error ? error.message : "No autorizado." }, { status: error instanceof Error && "status" in error ? Number((error as { status: number }).status) : 403 }); } }
