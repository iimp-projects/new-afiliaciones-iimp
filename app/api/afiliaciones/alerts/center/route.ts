import { NextResponse } from "next/server";
import { OperationalAlertStatus } from "@prisma/client";
import { contextService } from "@/modules/auth/context/service";
import { operationalAlertManagementService } from "@/modules/afiliaciones/alerts/Services/OperationalAlertManagementService";

const statuses = new Set(Object.values(OperationalAlertStatus));
const severities = new Set(["CRITICAL", "WARNING"]);

export async function GET(request: Request) {
  try {
    await contextService.requirePermission("read", "memberships");
    const params = new URL(request.url).searchParams;
    const integer = (name: string, fallback: number, max: number) => {
      const value = Number(params.get(name) ?? fallback);
      return Number.isInteger(value) && value > 0 ? Math.min(value, max) : fallback;
    };
    const status = params.get("status"); const severity = params.get("severity"); const assignedUserId = params.get("assignedUserId"); const applicationId = params.get("applicationId");
    if (status && !statuses.has(status as OperationalAlertStatus)) return NextResponse.json({ message: "status inválido." }, { status: 422 });
    if (severity && !severities.has(severity)) return NextResponse.json({ message: "severity inválida." }, { status: 422 });
    if (assignedUserId && assignedUserId !== "UNASSIGNED" && (!/^\d+$/.test(assignedUserId) || Number(assignedUserId) < 1)) return NextResponse.json({ message: "assignedUserId inválido." }, { status: 422 });
    if (applicationId && (!/^\d+$/.test(applicationId) || Number(applicationId) < 1)) return NextResponse.json({ message: "applicationId inválido." }, { status: 400 });
    return NextResponse.json(await operationalAlertManagementService.listCenter({ page: integer("page", 1, 1_000_000), pageSize: integer("pageSize", 20, 100), search: params.get("search") ?? undefined, status: status as OperationalAlertStatus | undefined, severity: severity ?? undefined, type: params.get("type") ?? undefined, applicationId: applicationId ? Number(applicationId) : undefined, assignedUserId: assignedUserId === "UNASSIGNED" ? "UNASSIGNED" : assignedUserId ? Number(assignedUserId) : undefined }));
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "No autorizado." }, { status: 403 });
  }
}
