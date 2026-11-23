export type AssociateDocumentSlot =
  | "ID_DOCUMENT"
  | "PHOTO"
  | "STUDY_CERTIFICATE"
  | "CV"
  | "DEGREE_CERTIFICATE"
  | "RECOMMENDATION_LETTER"
  | "PAYMENT_VOUCHER"
  | "OTHER";

export const ASSOCIATE_DOCUMENT_SLOT_LABELS: Record<AssociateDocumentSlot, string> = {
  ID_DOCUMENT: "Documento de identidad",
  PHOTO: "Fotografía",
  STUDY_CERTIFICATE: "Constancia de estudios",
  CV: "Curriculum vitae",
  DEGREE_CERTIFICATE: "Título o grado",
  RECOMMENDATION_LETTER: "Carta de recomendación",
  PAYMENT_VOUCHER: "Comprobante de pago",
  OTHER: "Documento adicional",
};

export function requiredAssociateDocumentSlots(isStudent: boolean): AssociateDocumentSlot[] {
  return isStudent
    ? ["ID_DOCUMENT", "PHOTO", "STUDY_CERTIFICATE"]
    : ["ID_DOCUMENT", "PHOTO"];
}

export function resolveAssociateDocumentSlot(document: {
  category: string;
  mimeType?: string | null;
  fileName?: string | null;
}): AssociateDocumentSlot {
  if (document.category !== "OTHER") return document.category as AssociateDocumentSlot;
  if (String(document.mimeType ?? "").toLowerCase().startsWith("image/") || /foto|photo|perfil/i.test(document.fileName ?? "")) {
    return "PHOTO";
  }
  if (/constancia|estudio|universit|carta/i.test(document.fileName ?? "")) {
    return "STUDY_CERTIFICATE";
  }
  return "OTHER";
}

export function associateDocumentCategory(slot: AssociateDocumentSlot): {
  category: "ID_DOCUMENT" | "CV" | "DEGREE_CERTIFICATE" | "RECOMMENDATION_LETTER" | "PAYMENT_VOUCHER" | "OTHER";
  fileNamePrefix?: string;
} {
  if (slot === "PHOTO") return { category: "OTHER", fileNamePrefix: "Fotografia" };
  if (slot === "STUDY_CERTIFICATE") return { category: "OTHER", fileNamePrefix: "Constancia" };
  return { category: slot };
}
