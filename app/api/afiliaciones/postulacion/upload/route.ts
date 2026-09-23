import { NextRequest, NextResponse } from "next/server";
import { S3StorageService } from "@/modules/shared/Services/S3StorageService";
import { QUERY_COOKIE, queryAuthorization } from "@/modules/afiliaciones/consulta/Services/QueryAuthorizationService";
import { contextService } from "@/modules/auth/context/service";
import { getInternalApiUser } from "@/modules/auth/context/api-authorization";
import { AVATAR_DESTINATION_PREFIX, isAvatarUploadFolder, resolveApplicationFolderKind } from "@/modules/afiliaciones/postulacion/Services/UploadDestinationResolver";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

function matchesDeclaredType(buffer: Buffer, mimeType: string): boolean {
  if (mimeType === "application/pdf") return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
  if (mimeType === "image/jpeg") return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimeType === "image/png") return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mimeType === "image/webp") return buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  return false;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const candidate = formData.get("file");
    if (!(candidate instanceof File))
      return NextResponse.json({ message: "No hay archivo." }, { status: 400 });
    if (candidate.size < 1 || candidate.size > MAX_FILE_SIZE) {
      return NextResponse.json({ message: "El archivo debe pesar como máximo 10 MB." }, { status: 413 });
    }

    const buffer = Buffer.from(await candidate.arrayBuffer());
    if (!matchesDeclaredType(buffer, candidate.type)) {
      return NextResponse.json({ message: "El contenido no coincide con un tipo de archivo permitido." }, { status: 415 });
    }

    const requestedFolder = formData.get("folder");
    const user = await getInternalApiUser();

    if (isAvatarUploadFolder(requestedFolder)) {
      const canManageUsers = Boolean(
        user
        && ((await contextService.hasPermission("update", "users"))
          || (await contextService.hasPermission("create", "users"))),
      );
      if (!canManageUsers) {
        return NextResponse.json({ message: "No autorizado." }, { status: 403 });
      }

      const s3Service = new S3StorageService();
      const avatarUrl = await s3Service.uploadFile(buffer, candidate.name, candidate.type, AVATAR_DESTINATION_PREFIX);
      return NextResponse.json({ success: true, data: { url: avatarUrl, name: candidate.name, type: candidate.type } });
    }

    const applicantApplicationId = queryAuthorization.allowedIds(request.cookies.get(QUERY_COOKIE)?.value)[0];
    const requestedApplicationId = Number(formData.get("applicationId"));
    const internalAccess = Boolean(user && await contextService.hasPermission("update", "memberships"));
    const applicationId = applicantApplicationId
      || (internalAccess && Number.isSafeInteger(requestedApplicationId) && requestedApplicationId > 0 ? requestedApplicationId : null);
    if (!applicationId) {
      return NextResponse.json({ message: "Verifica tu identidad para subir archivos." }, { status: 401 });
    }

    const kind = resolveApplicationFolderKind(requestedFolder);
    if (!kind) {
      return NextResponse.json({ message: "Destino de archivo no permitido." }, { status: 400 });
    }

    const folder = `afiliaciones/applications/${applicationId}/${kind}`;
    const s3Service = new S3StorageService();
    const fileUrl = await s3Service.uploadFile(buffer, candidate.name, candidate.type, folder);

    return NextResponse.json({
      success: true,
      data: { url: fileUrl, name: candidate.name, type: candidate.type },
    });
  } catch (error: unknown) {
    console.error("[Upload] No se pudo almacenar el archivo:", error);
    return NextResponse.json({ message: "No se pudo subir el archivo." }, { status: 500 });
  }
}
