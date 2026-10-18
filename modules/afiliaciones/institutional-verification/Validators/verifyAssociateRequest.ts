import { z } from "zod";

export const VERIFY_DOCUMENT_TYPES = ["DNI", "CE", "PASSPORT"] as const;
export type VerifyDocumentType = (typeof VERIFY_DOCUMENT_TYPES)[number];

export type VerifyAssociateRequest = {
  documentType: VerifyDocumentType;
  documentNumber: string;
};

export class VerifyAssociateRequestValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VerifyAssociateRequestValidationError";
  }
}

/**
 * Validación estricta del payload de verificación. Rechaza claves desconocidas,
 * tipos de documento no soportados y números de documento malformados.
 * El servidor es la única fuente de verdad; el cliente nunca valida por sí solo.
 */
export const verifyAssociateRequestSchema = z
  .object({
    documentType: z.enum(VERIFY_DOCUMENT_TYPES),
    documentNumber: z.string(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const trimmed = value.documentNumber.trim();
    if (value.documentType === "DNI") {
      if (!/^\d{8}$/.test(trimmed)) {
        ctx.addIssue({
          code: "custom",
          path: ["documentNumber"],
          message: "El DNI debe contener exactamente 8 dígitos.",
        });
      }
      return;
    }
    if (value.documentType === "CE") {
      if (!/^[A-Za-z0-9]{9,12}$/.test(trimmed)) {
        ctx.addIssue({
          code: "custom",
          path: ["documentNumber"],
          message: "El CE debe contener entre 9 y 12 caracteres alfanuméricos.",
        });
      }
      return;
    }
    if (!/^[A-Za-z0-9]{6,12}$/.test(trimmed)) {
      ctx.addIssue({
        code: "custom",
        path: ["documentNumber"],
        message: "El pasaporte debe contener entre 6 y 12 caracteres alfanuméricos.",
      });
    }
  });

export function parseVerifyAssociateRequest(input: unknown): VerifyAssociateRequest {
  const parsed = verifyAssociateRequestSchema.safeParse(input);
  if (!parsed.success) {
    throw new VerifyAssociateRequestValidationError(parsed.error.issues[0]?.message ?? "Payload inválido.");
  }
  const documentType = parsed.data.documentType;
  const documentNumber = documentType === "DNI" ? parsed.data.documentNumber.trim() : parsed.data.documentNumber.trim().toUpperCase();
  return { documentType, documentNumber };
}
