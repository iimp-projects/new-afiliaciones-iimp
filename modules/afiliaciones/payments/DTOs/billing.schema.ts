import { z } from "zod";
import { isValidBillingDocument } from "../Rules/BillingDocumentRules";

export const billingDataSchema = z.object({
  tipoDocumento: z.enum(["DNI", "CE", "RUC"]),
  numeroDocumento: z.string().trim().min(1, "El número de documento es obligatorio.").max(20),
  razonSocial: z.string().trim().min(1, "El nombre o razón social es obligatorio.").max(250),
  direccionFiscal: z.string().trim().min(1, "La dirección fiscal es obligatoria.").max(250),
  responsable: z.string().trim().min(1, "El responsable de facturación es obligatorio.").max(150),
  emailFacturacion: z.string().trim().email("El correo de facturación no es válido.").max(150),
}).superRefine((data, context) => {
  if (isValidBillingDocument(data.tipoDocumento, data.numeroDocumento)) return;
  const message = data.tipoDocumento === "DNI"
    ? "El DNI debe contener exactamente 8 dígitos numéricos."
    : data.tipoDocumento === "RUC"
      ? "El RUC debe contener exactamente 11 dígitos numéricos."
      : "El Carnet de Extranjería solo debe contener números y tener como máximo 20 dígitos.";
  context.addIssue({ code: z.ZodIssueCode.custom, path: ["numeroDocumento"], message });
});

export type BillingDataInput = z.infer<typeof billingDataSchema>;
