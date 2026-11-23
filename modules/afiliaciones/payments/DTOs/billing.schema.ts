import { z } from "zod";
import {
  BILLING_BUSINESS_NAME_MAX_LENGTH,
  BILLING_CONTACT_MAX_LENGTH,
  BILLING_EMAIL_MAX_LENGTH,
  BILLING_FISCAL_ADDRESS_MAX_LENGTH,
  isValidBillingDocument,
  isValidBillingEmail,
  isValidBillingName,
  isValidFiscalAddress,
} from "../Rules/BillingDocumentRules";

export const billingDataSchema = z.object({
  tipoDocumento: z.enum(["DNI", "CE", "PASSPORT", "RUC"]),
  numeroDocumento: z.string().trim().min(1, "El número de documento es obligatorio.").max(20).transform((value) => value.toUpperCase()),
  razonSocial: z.string().trim().min(1, "El nombre o razón social es obligatorio.").max(BILLING_BUSINESS_NAME_MAX_LENGTH, "El nombre o razón social no debe superar los 250 caracteres.")
    .refine(isValidBillingName, "El nombre o razón social debe contener letras o números."),
  direccionFiscal: z.string().trim().min(1, "La dirección fiscal es obligatoria.").max(BILLING_FISCAL_ADDRESS_MAX_LENGTH, "La dirección fiscal no debe superar los 250 caracteres.")
    .refine(isValidFiscalAddress, "Ingrese una dirección fiscal válida (mínimo 5 caracteres)."),
  responsable: z.string().trim().min(1, "El responsable de facturación es obligatorio.").max(BILLING_CONTACT_MAX_LENGTH, "El responsable de facturación no debe superar los 150 caracteres."),
  emailFacturacion: z.string().trim().min(1, "El correo de facturación es obligatorio.").max(BILLING_EMAIL_MAX_LENGTH, "El correo de facturación no debe superar los 150 caracteres.")
    .refine(isValidBillingEmail, "El correo de facturación no es válido."),
}).superRefine((data, context) => {
  if (isValidBillingDocument(data.tipoDocumento, data.numeroDocumento)) return;
  const message = data.tipoDocumento === "DNI"
    ? "El DNI debe contener exactamente 8 dígitos numéricos."
    : data.tipoDocumento === "RUC"
      ? "El RUC debe contener 11 dígitos numéricos y un dígito verificador válido."
      : data.tipoDocumento === "CE"
        ? "El Carnet de Extranjería debe ser alfanumérico y tener como máximo 15 caracteres."
        : "El Pasaporte debe ser alfanumérico y tener entre 6 y 12 caracteres.";
  context.addIssue({ code: z.ZodIssueCode.custom, path: ["numeroDocumento"], message });
});

export type BillingDataInput = z.infer<typeof billingDataSchema>;
