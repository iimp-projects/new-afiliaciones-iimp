import { NextResponse } from "next/server";
import { contextService } from "@/modules/auth/context/service";
import { operationalAlertManagementService } from "@/modules/afiliaciones/alerts/Services/OperationalAlertManagementService";

export async function GET() {
  try {
    await contextService.requirePermission("read", "alerts");
    return NextResponse.json({ data: await operationalAlertManagementService.listEligibleAssignees() });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "No autorizado." }, { status: 403 });
  }
}
