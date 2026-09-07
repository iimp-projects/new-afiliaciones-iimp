import { z } from "zod";

const dateField = z.coerce.date();

export const createSystemSettingValueSchema = z.object({
  value: z.string(),
  startsAt: dateField,
  endsAt: dateField.nullable().optional(),
  isActive: z.boolean().default(true),
}).strict();

export const updateSystemSettingValueSchema = z.object({
  value: z.string(),
  startsAt: dateField,
  endsAt: dateField.nullable().optional(),
  isActive: z.boolean(),
}).strict();

export const updateSystemSettingValueStatusSchema = z.object({
  isActive: z.boolean(),
}).strict();

export type CreateSystemSettingValueDTO = z.infer<typeof createSystemSettingValueSchema>;
export type UpdateSystemSettingValueDTO = z.infer<typeof updateSystemSettingValueSchema>;
export type UpdateSystemSettingValueStatusDTO = z.infer<typeof updateSystemSettingValueStatusSchema>;
