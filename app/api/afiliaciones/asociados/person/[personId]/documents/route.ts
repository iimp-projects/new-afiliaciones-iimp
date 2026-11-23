import { NextResponse } from "next/server";
import { ApiAuthorizationError, requireApiPermission } from "@/modules/auth/context/api-authorization";
import { AssociateAdminDataError } from "@/modules/afiliaciones/asociados/Services/AssociateAdminDataService";
import { AssociateAdminDocumentsService } from "@/modules/afiliaciones/asociados/Services/AssociateAdminDocumentsService";
import { ASSOCIATE_DOCUMENT_SLOT_LABELS, type AssociateDocumentSlot } from "@/modules/afiliaciones/asociados/Utilities/associateDocumentSlots";

function parsePersonId(value: string): number | null {
  const personId = Number(value);
  return Number.isInteger(personId) && personId > 0 ? personId : null;
}

function isSlot(value: unknown): value is AssociateDocumentSlot {
  return typeof value === "string" && value in ASSOCIATE_DOCUMENT_SLOT_LABELS;
}

export async function GET(_request: Request, { params }: { params: Promise<{ personId: string }> }) {
  try {
    await requireApiPermission("read", "associates");
    const personId = parsePersonId((await params).personId);
    if (!personId) return NextResponse.json({ success: false, message: "Asociado inválido." }, { status: 400 });
    const data = await new AssociateAdminDocumentsService().list(personId);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof ApiAuthorizationError) return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    if (error instanceof AssociateAdminDataError) return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    return NextResponse.json({ success: false, message: "No fue posible cargar los documentos." }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ personId: string }> }) {
  try {
    const actor = await requireApiPermission("update", "associates");
    const personId = parsePersonId((await params).personId);
    if (!personId) return NextResponse.json({ success: false, message: "Asociado inválido." }, { status: 400 });

    const form = await request.formData();
    const slot = form.get("slot");
    const file = form.get("file");
    if (!isSlot(slot)) return NextResponse.json({ success: false, message: "Tipo de documento inválido." }, { status: 400 });
    if (!(file instanceof File) || file.size === 0) return NextResponse.json({ success: false, message: "Selecciona un archivo." }, { status: 400 });

    const data = await new AssociateAdminDocumentsService().upload(actor.id, personId, slot, {
      buffer: Buffer.from(await file.arrayBuffer()),
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof ApiAuthorizationError) return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    if (error instanceof AssociateAdminDataError) return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    console.error("[ASSOCIATE_ADMIN_DOCUMENTS] Error inesperado:", { errorName: error instanceof Error ? error.name : typeof error });
    return NextResponse.json({ success: false, message: "No fue posible adjuntar el documento." }, { status: 500 });
  }
}
