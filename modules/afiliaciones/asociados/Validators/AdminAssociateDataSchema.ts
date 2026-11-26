import { DocumentType, Gender, StudyLevel } from "@prisma/client";
import { z } from "zod";
import { profileAddressSchema } from "../../portal/Validators/ProfileAddressSchema";

const optionalId = z.number().int().positive().nullable();
const optionalText = (max: number) => z.string().trim().max(max).nullable();

export const adminIdentitySchema = z.object({
  firstName: z.string().trim().min(1).max(150),
  paternalLastName: z.string().trim().min(1).max(150),
  maternalLastName: optionalText(150),
  documentType: z.enum(DocumentType),
  documentNumber: z.string().trim().min(1).max(50),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  gender: z.enum(Gender).nullable(),
  nationalityId: optionalId,
});

export const adminContactSchema = z.object({
  phone: z.string().trim().min(6).max(50).regex(/^[0-9+()\-\s]+$/),
  primaryEmail: z.string().trim().email().max(150).nullable(),
  secondaryEmail: z.string().trim().email().max(150).nullable(),
});

export const adminAcademicSchema = z
  .object({
    studyLevel: z.enum(StudyLevel),
    degreeId: optionalId,
    universityId: optionalId,
    specialtyId: optionalId,
    degreeTitle: optionalText(200),
    professionalAssociation: optionalText(200),
    licenseNumber: optionalText(50),
    graduationYear: z.number().int().min(1900).max(2100).nullable(),
    termOrSemester: optionalText(50),
  })
  .nullable();

export const employmentStatusSchema = z.enum(["EMPLOYED", "SELF_EMPLOYED", "NOT_WORKING"]);

export const adminEmploymentSchema = z
  .object({
    employmentStatus: employmentStatusSchema.nullable(),
    companyId: optionalId,
    positionId: optionalId,
    companyName: optionalText(250),
    positionName: optionalText(150),
    companyTaxId: optionalText(11),
    area: optionalText(150),
    workingAddress: optionalText(250),
    workPhone: optionalText(50),
    workExtension: optionalText(20),
    workEmail: z.string().trim().email().max(150).nullable(),
  })
  .nullable();

export const adminAssociateDataSchema = z.object({
  identity: adminIdentitySchema,
  contact: adminContactSchema,
  address: profileAddressSchema,
  academic: adminAcademicSchema,
  employment: adminEmploymentSchema,
});

export type AdminAssociateDataInput = z.infer<typeof adminAssociateDataSchema>;
