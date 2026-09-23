import type { PersonalInformation, UploadedFile } from "../Models/PersonalInformation";

/**
 * Carpetas S3 permitidas para los documentos del paso de datos personales.
 * El backend las traduce a un destino server-side mediante allow-list
 * (`resolveApplicationFolderKind`), por lo que el cliente nunca decide la ruta final.
 */
export const PERSONAL_INFORMATION_UPLOAD_FOLDERS = {
  photo: "afiliaciones/fotos",
  identityDocument: "afiliaciones/documentos",
} as const;

export type PersonalInformationUploadField = keyof typeof PERSONAL_INFORMATION_UPLOAD_FOLDERS;

export type FileUploader = (file: File, folder: string) => Promise<UploadedFile>;

export function isBrowserFile(value: unknown): value is File {
  return typeof File !== "undefined" && value instanceof File;
}

/**
 * Reemplaza los `File` pendientes por sus referencias S3 ya subidas.
 *
 * Importante: el upload requiere una postulación autorizada, por lo que esta
 * función debe invocarse SIEMPRE después de crear/recuperar el borrador
 * (que emite la cookie de acceso). No sube nada cuando el valor ya es una
 * referencia persistida.
 */
export async function resolvePersonalInformationUploads(
  personalInformation: PersonalInformation,
  upload: FileUploader,
  isFile: (value: unknown) => value is File = isBrowserFile,
): Promise<PersonalInformation> {
  const resolved: PersonalInformation = { ...personalInformation };
  for (const field of Object.keys(PERSONAL_INFORMATION_UPLOAD_FOLDERS) as PersonalInformationUploadField[]) {
    const value = personalInformation[field];
    if (isFile(value)) {
      resolved[field] = await upload(value, PERSONAL_INFORMATION_UPLOAD_FOLDERS[field]);
    } else if (value === undefined) {
      resolved[field] = null;
    }
  }
  return resolved;
}
