import { PDFDocument } from "pdf-lib";

export type AcademicDocumentFileErrorCode =
  | "EMPTY"
  | "TOO_LARGE"
  | "UNSUPPORTED_TYPE"
  | "MALFORMED"
  | "TOO_MANY_PAGES"
  | "RESOLUTION";

export class AcademicDocumentFileError extends Error {
  public constructor(
    public readonly code: AcademicDocumentFileErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AcademicDocumentFileError";
  }
}

export interface AcademicDocumentFilePolicy {
  readonly maxBytes: number;
  readonly maxPages: number;
  readonly maxImageDimension: number;
}

export interface ValidatedAcademicDocumentFile {
  readonly kind: "pdf" | "image";
  readonly pages: number | null;
  readonly width: number | null;
  readonly height: number | null;
}

const PDF_SIGNATURE = "%PDF-";
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MIN_IMAGE_DIMENSION = 200;

function matchesPdf(buffer: Buffer): boolean {
  return buffer.subarray(0, PDF_SIGNATURE.length).toString("ascii") === PDF_SIGNATURE;
}

function matchesJpeg(buffer: Buffer): boolean {
  return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
}

function matchesPng(buffer: Buffer): boolean {
  return buffer.length >= PNG_SIGNATURE.length && buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE);
}

function pngDimensions(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 24) return null;
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  return width > 0 && height > 0 ? { width, height } : null;
}

function jpegDimensions(buffer: Buffer): { width: number; height: number } | null {
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    if (offset + 4 > buffer.length) return null;
    const segmentLength = buffer.readUInt16BE(offset + 2);
    if (segmentLength < 2) return null;

    const isStartOfFrame = (marker >= 0xc0 && marker <= 0xc3)
      || (marker >= 0xc5 && marker <= 0xc7)
      || (marker >= 0xc9 && marker <= 0xcb)
      || (marker >= 0xcd && marker <= 0xcf);
    if (isStartOfFrame && offset + 9 <= buffer.length) {
      const height = buffer.readUInt16BE(offset + 5);
      const width = buffer.readUInt16BE(offset + 7);
      return width > 0 && height > 0 ? { width, height } : null;
    }

    offset += 2 + segmentLength;
  }
  return null;
}

/**
 * Valida el contenedor real del archivo (no solo el MIME declarado), el tamaño
 * y los límites de páginas/resolución antes de enviarlo al modelo. No modifica
 * el documento ni genera imágenes intermedias.
 */
export async function validateAcademicDocumentFile(
  buffer: Buffer,
  declaredMimeType: string,
  policy: AcademicDocumentFilePolicy,
): Promise<ValidatedAcademicDocumentFile> {
  if (!buffer.length) {
    throw new AcademicDocumentFileError("EMPTY", "El archivo está vacío.");
  }
  if (buffer.length > policy.maxBytes) {
    throw new AcademicDocumentFileError("TOO_LARGE", "El archivo supera el tamaño máximo permitido.");
  }

  if (matchesPdf(buffer)) {
    if (declaredMimeType !== "application/pdf") {
      throw new AcademicDocumentFileError("UNSUPPORTED_TYPE", "El contenido no corresponde al tipo declarado.");
    }
    let pages: number;
    try {
      const document = await PDFDocument.load(buffer, { updateMetadata: false });
      pages = document.getPageCount();
    } catch {
      throw new AcademicDocumentFileError("MALFORMED", "El PDF está dañado o protegido.");
    }
    if (pages < 1) {
      throw new AcademicDocumentFileError("MALFORMED", "El PDF no contiene páginas legibles.");
    }
    if (pages > policy.maxPages) {
      throw new AcademicDocumentFileError(
        "TOO_MANY_PAGES",
        `El documento supera el máximo de ${policy.maxPages} páginas para el análisis automático.`,
      );
    }
    return { kind: "pdf", pages, width: null, height: null };
  }

  const isPng = matchesPng(buffer);
  const isJpeg = matchesJpeg(buffer);
  if (!isPng && !isJpeg) {
    throw new AcademicDocumentFileError("UNSUPPORTED_TYPE", "Solo se admiten PDF, JPG o PNG.");
  }
  const expectedMime = isPng ? "image/png" : "image/jpeg";
  if (declaredMimeType !== expectedMime) {
    throw new AcademicDocumentFileError("UNSUPPORTED_TYPE", "El contenido no corresponde al tipo declarado.");
  }

  const dimensions = isPng ? pngDimensions(buffer) : jpegDimensions(buffer);
  if (!dimensions) {
    throw new AcademicDocumentFileError("MALFORMED", "No se pudo leer la imagen.");
  }
  if (dimensions.width < MIN_IMAGE_DIMENSION || dimensions.height < MIN_IMAGE_DIMENSION) {
    throw new AcademicDocumentFileError("RESOLUTION", "La imagen es demasiado pequeña para verificar el texto.");
  }
  if (dimensions.width > policy.maxImageDimension || dimensions.height > policy.maxImageDimension) {
    throw new AcademicDocumentFileError("RESOLUTION", "La imagen supera la resolución máxima permitida.");
  }

  return { kind: "image", pages: null, width: dimensions.width, height: dimensions.height };
}
