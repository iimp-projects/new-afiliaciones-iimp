import { z } from "zod";

export const billingDataSchema = z.object({
  tipoDocumento: z.enum(["DNI", "CE", "RUC"]),
  numeroDocumento: z.string().trim().min(1, "El número de documento es obligatorio.").max(20),
  razonSocial: z.string().trim().min(1, "El nombre o razón social es obligatorio.").max(250),
  direccionFiscal: z.string().trim().min(1, "La dirección fiscal es obligatoria.").max(250),
  responsable: z.string().trim().min(1, "El responsable de facturación es obligatorio.").max(150),
  emailFacturacion: z.string().trim().email("El correo de facturación no es válido.").max(150),
});

export type BillingDataInput = z.infer<typeof billingDataSchema>;

