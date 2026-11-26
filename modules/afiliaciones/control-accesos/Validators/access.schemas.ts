import { z } from "zod";

export const accessSourceSchema = z.enum(["QR_USB", "QR_CAMERA", "MANUAL_SEARCH"]);
export const movementTypeSchema = z.enum(["ENTRY", "EXIT"]);
export const movementModeSchema = z.enum(["ENTRY", "EXIT", "BOTH"]);

const idSchema = z.coerce.number().int().positive();
const optionalText = (max: number) => z.string().trim().max(max).optional();
const isoDate = z.string().trim().min(8).max(40);

export const validateAccessSchema = z
  .object({
    rawQr: z.string().trim().max(2048).optional(),
    personId: idSchema.optional(),
    siteId: idSchema,
    accessPointId: idSchema,
    movementType: movementTypeSchema.default("ENTRY"),
    source: accessSourceSchema.default("QR_USB"),
  })
  .refine((value) => Boolean(value.rawQr?.trim() || value.personId), {
    message: "Debe enviar un código QR o un identificador de asociado.",
    path: ["rawQr"],
  });

const idempotencyKey = z.string().trim().min(8).max(100).optional();

export const checkInSchema = z.object({
  ticket: z.string().trim().min(20).max(4096),
  idempotencyKey,
  adminOverride: z.boolean().optional(),
});

export const checkOutSchema = z.object({
  ticket: z.string().trim().min(20).max(4096),
  idempotencyKey,
  adminOverride: z.boolean().optional(),
  reason: optionalText(500),
});

export const searchQuerySchema = z.object({
  q: z.string().trim().min(3).max(120),
  siteId: idSchema.optional(),
  limit: z.coerce.number().int().min(1).max(20).default(10),
});

export const movementsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  siteId: idSchema.optional(),
  personId: idSchema.optional(),
  movementType: movementTypeSchema.optional(),
  validationResult: z.enum(["ALLOWED", "DENIED", "REVIEW_REQUIRED"]).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
});

export const presenceQuerySchema = z.object({
  siteId: idSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const dashboardQuerySchema = z.object({
  siteId: idSchema.optional(),
});

export const siteCreateSchema = z.object({
  code: z.string().trim().min(2).max(40),
  name: z.string().trim().min(3).max(150),
  address: optionalText(250),
  description: optionalText(2000),
});

export const siteUpdateSchema = z.object({
  name: z.string().trim().min(3).max(150).optional(),
  address: optionalText(250),
  description: optionalText(2000),
  isActive: z.boolean().optional(),
});

export const pointCreateSchema = z.object({
  siteId: idSchema,
  code: z.string().trim().min(2).max(40),
  name: z.string().trim().min(2).max(150),
  description: optionalText(2000),
  movementMode: movementModeSchema.default("BOTH"),
});

export const pointUpdateSchema = z.object({
  name: z.string().trim().min(2).max(150).optional(),
  description: optionalText(2000),
  movementMode: movementModeSchema.optional(),
  isActive: z.boolean().optional(),
});

export const policySchema = z.object({
  siteId: idSchema,
  name: z.string().trim().min(3).max(150).default("Política institucional"),
  allowedMembershipCategories: z.array(z.string().trim().min(1).max(80)).max(30).nullable().optional(),
  requireActiveMembership: z.boolean().default(true),
  requireValidCard: z.boolean().default(true),
  quotaRestrictionEnabled: z.boolean().default(false),
  maxPendingQuotas: z.coerce.number().int().min(0).max(999).nullable().optional(),
  allowManualLookup: z.boolean().default(true),
});

export const operatorAssignmentSchema = z.object({
  userId: z.coerce.number().int().positive(),
  siteId: idSchema,
  accessPointId: idSchema.optional(),
  isActive: z.boolean().default(true),
});

export const exportQuerySchema = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  siteId: idSchema.optional(),
});
