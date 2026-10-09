import { S3StorageService } from "./S3StorageService";
import { APPLICATION_KEY_PREFIX, LEGACY_DOCUMENT_KEY_PREFIX } from "@/modules/afiliaciones/postulacion/Services/ApplicationDocumentAccess";

export interface AffiliatePhotoDocument {
  mimeType: string | null;
  category: string | null;
  fileName: string | null;
  fileUrl: string | null;
}

export interface AffiliatePhotoApplication {
  documents: AffiliatePhotoDocument[];
}

function isPhotoDocument(document: AffiliatePhotoDocument): boolean {
  const isImage = !!document.mimeType?.startsWith("image/");
  const isPhotoByName = document.fileName?.toLowerCase().includes("foto") === true;
  return isImage && (document.category === "OTHER" || isPhotoByName);
}

/**
 * Resuelve la fotografía de un asociado a partir de los documentos de sus
 * postulaciones. Es la misma fuente usada por Asociados y Expedientes: el
 * documento de imagen cuyo `category` es `OTHER` o cuyo `fileName` contiene
 * "foto", firmado para lectura privada en S3.
 *
 * Devuelve la URL firmada, o `null` si no existe un documento de foto válido
 * o si la firma falla. El llamador decide el fallback (p. ej. el avatar del
 * usuario o las iniciales).
 */
export async function resolveAffiliatePhoto(
  applications: AffiliatePhotoApplication[],
): Promise<string | null> {
  const application = applications.find((candidate) =>
    candidate.documents.some(isPhotoDocument),
  );
  const photo = application?.documents.find(isPhotoDocument);
  if (!photo?.fileUrl) return null;

  try {
    return await new S3StorageService().getPresignedApplicationDocumentUrl(photo.fileUrl, [
      APPLICATION_KEY_PREFIX,
      LEGACY_DOCUMENT_KEY_PREFIX,
    ]);
  } catch {
    return null;
  }
}
