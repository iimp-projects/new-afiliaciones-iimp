import { NextResponse } from "next/server";
import { ApiAuthorizationError, requireApiPermission } from "@/modules/auth/context/api-authorization";
import { canManageApplicantNotifications } from "@/modules/afiliaciones/expedientes/Utils/applicantNotificationPermissions";
import { AssociateAdminDataError } from "@/modules/afiliaciones/asociados/Services/AssociateAdminDataService";
import { AssociateAdminDocumentsService } from "@/modules/afiliaciones/asociados/Services/AssociateAdminDocumentsService";
import { ASSOCIATE_DOCUMENT_SLOT_LABELS, type AssociateDocumentSlot } from "@/modules/afiliaciones/asociados/Utilities/associateDocumentSlots";

function parseId(value: string): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function isSlot(value: unknown): value is AssociateDocumentSlot {
  return typeof value === "string" && value in ASSOCIATE_DOCUMENT_SLOT_LABELS;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const applicationId = parseId((await params).id);
    if (!applicationId) return NextResponse.json({ success: false, message: "Expediente inválido." }, { status: 400 });
    const user = await requireApiPermission("read", "applications");
    if (!canManageApplicantNotifications(user.role.slug)) return NextResponse.json({ success: false, message: "No autorizado." }, { status: 403 });
    const data = await new AssociateAdminDocumentsService().listByApplication(applicationId);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof ApiAuthorizationError) return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    if (error instanceof AssociateAdminDataError) return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    return NextResponse.json({ success: false, message: "No fue posible cargar los documentos." }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const applicationId = parseId((await params).id);
    if (!applicationId) return NextResponse.json({ success: false, message: "Expediente inválido." }, { status: 400 });
    const user = await requireApiPermission("update", "applications");
    if (!canManageApplicantNotifications(user.role.slug)) return NextResponse.json({ success: false, message: "No autorizado." }, { status: 403 });

    const form = await request.formData();
    const slot = form.get("slot");
    const file = form.get("file");
    if (!isSlot(slot)) return NextResponse.json({ success: false, message: "Tipo de documento inválido." }, { status: 400 });
    if (!(file instanceof File) || file.size === 0) return NextResponse.json({ success: false, message: "Selecciona un archivo." }, { status: 400 });

    const data = await new AssociateAdminDocumentsService().uploadToApplication(user.id, applicationId, slot, {
      buffer: Buffer.from(await file.arrayBuffer()),
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof ApiAuthorizationError) return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    if (error instanceof AssociateAdminDataError) return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    console.error("[EXPEDIENTE_DOCUMENTS] Error inesperado:", { errorName: error instanceof Error ? error.name : typeof error });
    return NextResponse.json({ success: false, message: "No fue posible adjuntar el documento." }, { status: 500 });
  }
}
