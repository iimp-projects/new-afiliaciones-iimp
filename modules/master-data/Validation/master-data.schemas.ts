import { z } from "zod";

const nullableText = (max: number) => z.string().trim().max(max).nullable().optional();
const nullableUrl = z.union([z.literal(""), z.string().trim().url().max(500), z.null()]).optional();

const fields = {
  name: z.string().trim().min(1).max(250),
  code: nullableText(50),
  abbreviation: nullableText(50),
  studyLevel: z.enum(["BACHELOR", "MASTER", "DOCTORATE", "TECHNICAL", "OTHER"]).optional(),
  description: nullableText(2000),
  acronym: nullableText(50),
  website: nullableUrl,
  logoUrl: nullableUrl,
  websiteUrl: nullableUrl,
  facebookUrl: nullableUrl,
  instagramUrl: nullableUrl,
  linkedinUrl: nullableUrl,
  youtubeUrl: nullableUrl,
  isLicensed: z.boolean().optional(),
  isPublic: z.boolean().optional(),
  isActive: z.boolean().optional(),
  countryId: z.number().int().positive().optional(),
  specialtyCategoryId: z.number().int().positive().nullable().optional(),
};

export const masterDataCreateSchema = z.object(fields).strict();
export const masterDataUpdateSchema = z.object({ ...fields, name: fields.name.optional() }).strict().refine(
  (value) => Object.keys(value).length > 0,
  "Debe proporcionar al menos un campo.",
);
export const masterDataMergeSchema = z.object({
  entity: z.enum(["UNIVERSITY", "SPECIALTY"]),
  selectedIds: z.array(z.number().int().positive()).min(2).max(20),
  canonicalId: z.number().int().positive(),
  confirmation: z.boolean().optional(),
}).strict();
