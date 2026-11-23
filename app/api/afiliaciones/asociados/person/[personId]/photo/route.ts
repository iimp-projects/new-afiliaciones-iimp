import { NextResponse } from "next/server";
import { ApiAuthorizationError, requireApiPermission } from "@/modules/auth/context/api-authorization";
import { S3StorageService } from "@/modules/shared/Services/S3StorageService";
import { AssociateAdminDataError, AssociateAdminDataService } from "@/modules/afiliaciones/asociados/Services/AssociateAdminDataService";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function POST(request: Request, { params }: { params: Promise<{ personId: string }> }) {
  try {
    const actor = await requireApiPermission("update", "associates");
    const personId = Number((await params).personId);
    if (!Number.isInteger(personId) || personId <= 0) {
      return NextResponse.json({ success: false, message: "Asociado inválido." }, { status: 400 });
    }
    const form = await request.formData();
    const file = form.get("image");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ success: false, message: "Selecciona una imagen." }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ success: false, message: "La fotografía debe ser JPG, PNG o WEBP." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ success: false, message: "La fotografía no puede superar los 5 MB." }, { status: 400 });
    }

    const storage = new S3StorageService();
    const key = await storage.uploadPrivateFile(Buffer.from(await file.arrayBuffer()), file.name, file.type, "afiliaciones/perfiles");
    await new AssociateAdminDataService().updatePhoto(actor.id, personId, { key, fileName: file.name, mimeType: file.type, sizeBytes: file.size });
    const url = await storage.getPresignedAvatarUrl(key);
    return NextResponse.json({ success: true, data: { url } });
  } catch (error) {
    if (error instanceof ApiAuthorizationError) return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    if (error instanceof AssociateAdminDataError) return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    console.error("[ASSOCIATE_ADMIN_PHOTO] Error inesperado:", { errorName: error instanceof Error ? error.name : typeof error });
    return NextResponse.json({ success: false, message: "No fue posible actualizar la fotografía." }, { status: 500 });
  }
}
