import { z } from "zod";

const optionalText = (max: number) => z.string().trim().max(max).optional();
const optionalYear = z.coerce.number().int().min(1900).max(2100).optional();
const optionalMoney = z.string().regex(/^\d+(\.\d{1,2})?$/, "Importe inválido.").optional();
const optionalBoolean = z.preprocess((value) => {
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}, z.boolean().optional());

const quotaQueryBase = z.object({
  search: optionalText(120),
  year: optionalYear,
  yearFrom: optionalYear,
  yearTo: optionalYear,
  category: optionalText(10),
  membershipStatus: optionalText(40),
  accountingStatus: z.enum(["FACTURADO", "PENDIENTE"]).optional(),
  financialStatus: z.enum(["WITH_INFO", "NO_INFO", "NOT_FOUND", "FAILED", "WITH_INCIDENCES"]).optional(),
  currency: z.enum(["S/", "US$"]).optional(),
  concept: z.enum(["CUOTA", "INSCRIPCION"]).default("CUOTA"),
  pendingMin: optionalMoney,
  pendingMax: optionalMoney,
  hasIncidences: optionalBoolean,
  sort: z.enum(["name", "institutionalCode", "pendingPen", "pendingUsd", "pendingCount", "lastSync"]).default("name"),
  direction: z.enum(["asc", "desc"]).default("asc"),
});

export const quotaListQuerySchema = quotaQueryBase.extend({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
}).superRefine((value, context) => {
  if (value.yearFrom != null && value.yearTo != null && value.yearFrom > value.yearTo) {
    context.addIssue({ code: "custom", path: ["yearTo"], message: "yearTo no puede ser menor que yearFrom." });
  }
  if (value.pendingMin != null && value.pendingMax != null && Number(value.pendingMin) > Number(value.pendingMax)) {
    context.addIssue({ code: "custom", path: ["pendingMax"], message: "pendingMax no puede ser menor que pendingMin." });
  }
});

export const quotaHistoryQuerySchema = quotaQueryBase.extend({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  personId: z.coerce.number().int().positive().optional(),
  includeAbsent: optionalBoolean,
}).superRefine((value, context) => {
  if (value.yearFrom != null && value.yearTo != null && value.yearFrom > value.yearTo) {
    context.addIssue({ code: "custom", path: ["yearTo"], message: "yearTo no puede ser menor que yearFrom." });
  }
});

export const quotaIncidencesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(10),
  code: optionalText(100),
  status: z.enum(["PENDING", "RUNNING", "SUCCEEDED", "NO_DATA", "NOT_FOUND", "FAILED"]).optional(),
  includeResolved: optionalBoolean,
  resolvedOnly: optionalBoolean,
});

export const quotaSyncRunsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});

export const quotaSyncRunDetailQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(10),
});

export const quotaExportQuerySchema = z.object({
  type: z.enum(["associates", "history", "pending", "incidences", "summary"]).default("associates"),
  search: optionalText(120),
  year: optionalYear,
  yearFrom: optionalYear,
  yearTo: optionalYear,
  category: optionalText(10),
  membershipStatus: optionalText(40),
  accountingStatus: z.enum(["FACTURADO", "PENDIENTE"]).optional(),
  financialStatus: z.enum(["WITH_INFO", "NO_INFO", "NOT_FOUND", "FAILED", "WITH_INCIDENCES"]).optional(),
  currency: z.enum(["S/", "US$"]).optional(),
  concept: z.enum(["CUOTA", "INSCRIPCION"]).default("CUOTA"),
  pendingMin: optionalMoney,
  pendingMax: optionalMoney,
  hasIncidences: optionalBoolean,
  includeAbsent: optionalBoolean,
  code: optionalText(100),
  status: z.enum(["PENDING", "RUNNING", "SUCCEEDED", "NO_DATA", "NOT_FOUND", "FAILED"]).optional(),
  sort: z.enum(["name", "institutionalCode", "pendingPen", "pendingUsd", "pendingCount", "lastSync"]).default("name"),
  direction: z.enum(["asc", "desc"]).default("asc"),
});

export type QuotaListQuery = z.infer<typeof quotaListQuerySchema>;
export type QuotaHistoryQuery = z.infer<typeof quotaHistoryQuerySchema>;
export type QuotaIncidencesQuery = z.infer<typeof quotaIncidencesQuerySchema>;
export type QuotaSyncRunsQuery = z.infer<typeof quotaSyncRunsQuerySchema>;
export type QuotaSyncRunDetailQuery = z.infer<typeof quotaSyncRunDetailQuerySchema>;
export type QuotaExportQuery = z.infer<typeof quotaExportQuerySchema>;

export function parseQuotaQuery<T>(schema: z.ZodType<T>, searchParams: URLSearchParams): T {
  const raw: Record<string, string> = {};
  for (const [key, value] of searchParams.entries()) {
    if (value !== "") raw[key] = value;
  }
  return schema.parse(raw);
}
