import { NextResponse } from "next/server";
import { operationalAlertManagementService } from "@/modules/afiliaciones/alerts/Services/OperationalAlertManagementService";
import { contextService } from "@/modules/auth/context/service";
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) { try { await contextService.requirePermission("read", "memberships"); const alert = await operationalAlertManagementService.getAlertDetail(Number((await params).id)); if (!alert) return NextResponse.json({ message: "Alerta no encontrada." }, { status: 404 }); return NextResponse.json(alert); } catch (error) { return NextResponse.json({ message: error instanceof Error ? error.message : "No autorizado." }, { status: 403 }); } }
