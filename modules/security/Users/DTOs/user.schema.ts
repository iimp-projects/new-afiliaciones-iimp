import { z } from "zod";
import { DocumentType, UserType } from "@prisma/client";

export const createUserSchema = z.object({
  documentType: z.nativeEnum(DocumentType, { message: "Tipo de documento inv lido." }),
  documentNumber: z.string().min(8, "El n mero de documento debe tener al menos 8 caracteres."),
  firstName: z.string().min(2, "El nombre es obligatorio."),
  paternalLastName: z.string().min(2, "El apellido paterno es obligatorio."),
  maternalLastName: z.string().optional(),
  email: z.string().email("El correo electr nico no es v lido."),
  roleId: z.coerce.number().min(1, "Debe seleccionar un rol."),
  userType: z.nativeEnum(UserType).default(UserType.VALIDATOR),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;