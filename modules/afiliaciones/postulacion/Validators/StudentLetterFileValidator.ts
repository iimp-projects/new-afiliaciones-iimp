export type DocumentUploadKind = "student-letter" | "identity" | "photo" | "declaration";

export const MAX_STUDENT_LETTER_BYTES = 10 * 1024 * 1024;

const MIME_BY_EXTENSION: Readonly<Record<string, readonly string[]>> = {
  ".pdf": ["application/pdf"],
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
  ".png": ["image/png"],
  ".webp": ["image/webp"],
};

interface DocumentUploadConfig {
  extensions: readonly string[];
  maxBytes: number;
  maxMb: number;
  label: string;
  formatLabel: string;
}

const DOCUMENT_CONFIG: Readonly<Record<DocumentUploadKind, DocumentUploadConfig>> = {
  "student-letter": {
    extensions: [".pdf", ".jpg", ".jpeg", ".png"],
    maxBytes: MAX_STUDENT_LETTER_BYTES,
    maxMb: 10,
    label: "la constancia de estudios",
    formatLabel: "PDF, JPG, JPEG o PNG",
  },
  identity: {
    extensions: [".pdf", ".jpg", ".jpeg", ".png", ".webp"],
    maxBytes: 10 * 1024 * 1024,
    maxMb: 10,
    label: "el documento de identidad",
    formatLabel: "PDF, JPG, JPEG, PNG o WEBP",
  },
  photo: {
    extensions: [".pdf", ".jpg", ".jpeg", ".png", ".webp"],
    maxBytes: 10 * 1024 * 1024,
    maxMb: 10,
    label: "la fotografía",
    formatLabel: "PDF, JPG, JPEG, PNG o WEBP",
  },
  declaration: {
    extensions: [".pdf", ".jpg", ".jpeg", ".png", ".webp"],
    maxBytes: 3 * 1024 * 1024,
    maxMb: 3,
    label: "la declaración firmada",
    formatLabel: "PDF, JPG, JPEG, PNG o WEBP",
  },
};

interface DocumentUploadFileLike {
  name: string;
  size: number;
  type: string;
}

/**
 * Validación previa en cliente para los documentos de la postulación.
 * El servidor mantiene su propia validación de tipo, tamaño y contenido.
 */
export function validateDocumentUpload(
  file: DocumentUploadFileLike,
  kind: DocumentUploadKind,
): string | null {
  const config = DOCUMENT_CONFIG[kind];

  if (file.size <= 0) {
    return `El archivo de ${config.label} está vacío. Selecciona un documento válido.`;
  }

  if (file.size > config.maxBytes) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    return `El archivo de ${config.label} pesa ${sizeMb} MB y supera el máximo permitido de ${config.maxMb} MB.`;
  }

  const extension = `.${file.name.split(".").pop()?.toLowerCase() ?? ""}`;
  if (!config.extensions.includes(extension)) {
    return `Formato no permitido para ${config.label}. Usa ${config.formatLabel}.`;
  }

  const expectedMimes = MIME_BY_EXTENSION[extension];
  if (file.type && expectedMimes && !expectedMimes.includes(file.type)) {
    return `El contenido del archivo no coincide con su extensión. Verifica ${config.label} e inténtalo de nuevo.`;
  }

  return null;
}

export function validateStudentLetterFile(file: DocumentUploadFileLike): string | null {
  return validateDocumentUpload(file, "student-letter");
}
