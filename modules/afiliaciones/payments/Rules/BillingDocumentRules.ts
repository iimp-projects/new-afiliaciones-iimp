export type BillingDocumentType = "DNI" | "CE" | "RUC";
export type BillingInvoiceType = "BOLETA" | "FACTURA";

const DNI_LENGTH = 8;
const RUC_LENGTH = 11;
const NUMERIC_DOCUMENT = /^\d+$/;

export function isNumericDocument(value: string): boolean {
  return NUMERIC_DOCUMENT.test(value);
}

export function isValidDni(value: string): boolean {
  return value.length === DNI_LENGTH && isNumericDocument(value);
}

export function isValidRuc(value: string): boolean {
  return value.length === RUC_LENGTH && isNumericDocument(value);
}

export function isPersonalRuc(ruc: string): boolean {
  return isValidRuc(ruc) && ruc.startsWith("10");
}

export function isPersonalRucForDocument(ruc: string, dni: string): boolean {
  return isPersonalRuc(ruc) && isValidDni(dni) && ruc.slice(2, 10) === dni;
}

export function isLegalEntityRuc(ruc: string): boolean {
  return isValidRuc(ruc) && ruc.startsWith("20");
}

export function resolveInvoiceType(documentType: BillingDocumentType): BillingInvoiceType {
  return documentType === "RUC" ? "FACTURA" : "BOLETA";
}

export function isValidBillingDocument(documentType: BillingDocumentType, documentNumber: string): boolean {
  if (documentType === "DNI") return isValidDni(documentNumber);
  if (documentType === "RUC") return isValidRuc(documentNumber);
  return documentNumber.length > 0 && documentNumber.length <= 20 && isNumericDocument(documentNumber);
}
