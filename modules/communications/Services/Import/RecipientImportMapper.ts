import { normalizeHeader } from "./EmailProcessing";
import type { FieldMapping } from "../../Models/RecipientImport";

const EMAIL_VARIANTS = new Set(["CORREO", "CORREO ELECTRONICO", "EMAIL", "E-MAIL"]);
const NAME_VARIANTS = new Set(["NOMBRE", "NOMBRES Y APELLIDOS", "NOMBRE Y APELLIDOS", "PERSONA DE CONTACTO", "PARTICIPANTE", "NOMBRE COMPLETO"]);
const COMPANY_VARIANTS = new Set(["EMPRESA", "COMPANIA", "RAZON SOCIAL"]);
const POSITION_VARIANTS = new Set(["CARGO"]);
const RUC_VARIANTS = new Set(["RUC"]);
const PHONE_VARIANTS = new Set(["CELULAR", "TELEFONO", "NUMERO DE CONTACTO"]);

/**
 * Detecta la columna de email y el resto de campos opcionales a partir de los
 * encabezados de una hoja. Devuelve null si no encuentra una columna de email,
 * para permitir mapping manual.
 */
export function detectFieldMapping(headers: string[]): FieldMapping | null {
  const normalized = headers.map((header) => normalizeHeader(header));
  const emailIndex = normalized.findIndex((header) => EMAIL_VARIANTS.has(header));
  if (emailIndex === -1) return null;

  const mapping: FieldMapping = { email: headers[emailIndex] };

  const find = (variants: Set<string>): string | undefined => {
    const index = normalized.findIndex((header) => variants.has(header));
    return index === -1 ? undefined : headers[index];
  };

  const name = find(NAME_VARIANTS);
  if (name) mapping.name = name;
  const company = find(COMPANY_VARIANTS);
  if (company) mapping.company = company;
  const position = find(POSITION_VARIANTS);
  if (position) mapping.position = position;
  const ruc = find(RUC_VARIANTS);
  if (ruc) mapping.ruc = ruc;
  const phone = find(PHONE_VARIANTS);
  if (phone) mapping.phone = phone;

  return mapping;
}
