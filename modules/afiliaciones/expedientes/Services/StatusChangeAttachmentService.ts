import { S3StorageService, isObjectKeyAllowed } from "@/modules/shared/Services/S3StorageService";

export interface StatusChangeAttachmentRef {
  applicationId: number;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  mimeType?: string | null;
}

export interface ResolvedEmailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

export class StatusChangeAttachmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StatusChangeAttachmentError";
  }
}

const MAX_EMAIL_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MAX_FILENAME_LENGTH = 200;

const MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export class StatusChangeAttachmentService {
  constructor(
    private readonly s3: S3StorageService = new S3StorageService(),
    private readonly maxBytes: number = MAX_EMAIL_ATTACHMENT_BYTES,
  ) {}

  async resolve(ref: StatusChangeAttachmentRef): Promise<ResolvedEmailAttachment[]> {
    if (!ref.attachmentUrl) return [];

    const key = this.s3.getObjectKey(ref.attachmentUrl);
    const prefix = `afiliaciones/applications/${ref.applicationId}`;
    if (!isObjectKeyAllowed(key, [prefix])) {
      throw new StatusChangeAttachmentError("El documento no pertenece a este expediente.");
    }

    const buffer = await this.s3.getObjectBuffer(ref.attachmentUrl, [prefix]);
    if (buffer.length === 0) {
      throw new StatusChangeAttachmentError("El documento adjunto está vacío.");
    }
    if (buffer.length > this.maxBytes) {
      throw new StatusChangeAttachmentError("El documento excede el tamaño máximo permitido para adjuntar por correo.");
    }

    return [
      {
        filename: this.resolveFilename(ref.attachmentName, key),
        content: buffer,
        contentType: this.resolveContentType(ref.mimeType, key),
      },
    ];
  }

  private resolveFilename(name: string | null | undefined, key: string): string {
    const sanitized = (name ?? "")
      .replace(/[\\/]+/g, "_")
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .trim()
      .slice(0, MAX_FILENAME_LENGTH);

    if (sanitized) return sanitized;

    const basename = key.split("/").pop() || "documento_adjunto";
    return basename.length > MAX_FILENAME_LENGTH ? basename.slice(-MAX_FILENAME_LENGTH) : basename;
  }

  private resolveContentType(mimeType: string | null | undefined, key: string): string {
    if (mimeType && /^[\w.+-]+\/[\w.+-]+$/.test(mimeType)) return mimeType;

    const extension = (key.split(".").pop() || "").toLowerCase();
    return MIME_BY_EXTENSION[extension] ?? "application/octet-stream";
  }
}
