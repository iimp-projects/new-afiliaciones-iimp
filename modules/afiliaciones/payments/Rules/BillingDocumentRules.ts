export type BillingDocumentType = "DNI" | "CE" | "PASSPORT" | "RUC";
export type BillingInvoiceType = "BOLETA" | "FACTURA";

const DNI_LENGTH = 8;
const RUC_LENGTH = 11;
const CE_MAX_LENGTH = 15;
const PASSPORT_MIN_LENGTH = 6;
const PASSPORT_MAX_LENGTH = 12;
const NUMERIC_DOCUMENT = /^\d+$/;
const ALPHANUMERIC_DOCUMENT = /^[A-Za-z0-9]+$/;
const RUC_FACTORS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2] as const;

export const BILLING_BUSINESS_NAME_MAX_LENGTH = 250;
export const BILLING_FISCAL_ADDRESS_MIN_LENGTH = 5;
export const BILLING_FISCAL_ADDRESS_MAX_LENGTH = 250;
export const BILLING_CONTACT_MAX_LENGTH = 150;
export const BILLING_EMAIL_MAX_LENGTH = 150;

const BILLING_NAME_PATTERN = /[\p{L}\p{N}]/u;
const FISCAL_ADDRESS_PATTERN = /^[\p{L}\p{M}0-9 ,.#°()/-]+$/u;
const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,}$/;

export function isNumericDocument(value: string): boolean {
  return NUMERIC_DOCUMENT.test(value);
}

export function isValidDni(value: string): boolean {
  return value.length === DNI_LENGTH && isNumericDocument(value);
}

/** Dígito verificador del RUC peruano (módulo 11 con factores SUNAT). */
export function hasValidRucCheckDigit(value: string): boolean {
  if (value.length !== RUC_LENGTH || !isNumericDocument(value)) return false;
  let sum = 0;
  for (let index = 0; index < 10; index++) sum += Number(value[index]) * RUC_FACTORS[index];
  const checkDigit = (11 - (sum % 11)) % 11;
  return (checkDigit === 10 ? 0 : checkDigit) === Number(value[10]);
}

export function isValidRuc(value: string): boolean {
  return value.length === RUC_LENGTH && isNumericDocument(value) && hasValidRucCheckDigit(value);
}

export function isValidCe(value: string): boolean {
  return value.length >= 1 && value.length <= CE_MAX_LENGTH && ALPHANUMERIC_DOCUMENT.test(value);
}

export function isValidPassport(value: string): boolean {
  return value.length >= PASSPORT_MIN_LENGTH && value.length <= PASSPORT_MAX_LENGTH && ALPHANUMERIC_DOCUMENT.test(value);
}

export function sanitizeBillingDocumentNumber(documentType: BillingDocumentType, value: string): string {
  if (documentType === "DNI") return value.replace(/\D/g, "").slice(0, DNI_LENGTH);
  if (documentType === "RUC") return value.replace(/\D/g, "").slice(0, RUC_LENGTH);
  if (documentType === "PASSPORT") return value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, PASSPORT_MAX_LENGTH);
  return value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, CE_MAX_LENGTH);
}

export function isValidBillingName(value: string): boolean {
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length > 0 && normalized.length <= BILLING_BUSINESS_NAME_MAX_LENGTH && BILLING_NAME_PATTERN.test(normalized);
}

export function isValidFiscalAddress(value: string): boolean {
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length >= BILLING_FISCAL_ADDRESS_MIN_LENGTH
    && normalized.length <= BILLING_FISCAL_ADDRESS_MAX_LENGTH
    && FISCAL_ADDRESS_PATTERN.test(normalized)
    && BILLING_NAME_PATTERN.test(normalized);
}

export function isValidBillingEmail(value: string): boolean {
  const email = value.trim();
  if (!email || email.length > BILLING_EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(email)) return false;
  const at = email.lastIndexOf("@");
  const local = email.slice(0, at);
  const domain = email.slice(at + 1).toLowerCase();
  if (!local || local.startsWith(".") || local.endsWith(".") || local.includes("..")) return false;
  return domain.split(".").every((label) => label.length > 0 && label.length <= 63 && !label.startsWith("-") && !label.endsWith("-"));
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
  if (documentType === "PASSPORT") return isValidPassport(documentNumber);
  return isValidCe(documentNumber);
}
