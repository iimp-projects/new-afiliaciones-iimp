export const AVATAR_UPLOAD_FOLDER = "users/avatars";
export const AVATAR_DESTINATION_PREFIX = "afiliaciones/perfiles";

const APPLICATION_FOLDER_KIND: Readonly<Record<string, string>> = {
  "afiliaciones/fotos": "photos",
  "afiliaciones/documentos": "identity-documents",
  "afiliaciones/estudiantes": "education-documents",
  "afiliaciones/declaraciones": "declarations",
  "afiliaciones/observaciones": "observations",
};

const SUBSANACIONES_PARTS = ["afiliaciones", null, "subsanaciones"] as const;

/**
 * Traduce la carpeta declarada por el cliente a un tipo de destino server-side.
 * Devuelve `null` para cualquier carpeta no listada (allow-list explícita).
 */
export function resolveApplicationFolderKind(folder: unknown): string | null {
  if (typeof folder !== "string") return null;
  const exact = APPLICATION_FOLDER_KIND[folder];
  if (exact) return exact;
  if (isSubsanacionesFolder(folder)) return "observations";
  return null;
}

function isSubsanacionesFolder(folder: string): boolean {
  const parts = folder.split("/");
  if (parts.length !== SUBSANACIONES_PARTS.length) return false;
  const trackingCode = parts[1];
  return parts[0] === SUBSANACIONES_PARTS[0]
    && parts[2] === SUBSANACIONES_PARTS[2]
    && trackingCode.length > 0
    && trackingCode !== "."
    && trackingCode !== "..";
}

export function isAvatarUploadFolder(folder: unknown): boolean {
  return folder === AVATAR_UPLOAD_FOLDER;
}
