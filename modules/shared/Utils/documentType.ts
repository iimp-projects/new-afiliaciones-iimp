import type { DocumentType } from "@prisma/client";

const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  DNI: "DNI",
  CE: "CE",
  PASSPORT: "Pasaporte",
  OTHER: "Documento",
};

/**
 * Etiqueta de presentación para el tipo de documento.
 *
 * Nunca infiere el tipo a partir del número; solo traduce el enum almacenado.
 * Los valores desconocidos o ausentes se presentan como "Documento".
 */
export function documentTypeLabel(documentType: DocumentType | string | null | undefined): string {
  if (!documentType) return "Documento";
  return DOCUMENT_TYPE_LABELS[documentType as DocumentType] ?? "Documento";
}
