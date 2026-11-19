import { z } from "zod";

export const quotaSyncScopeSchema = z.enum(["PERSON", "BATCH", "FULL"]);

export const startQuotaSyncSchema = z
  .object({
    scope: quotaSyncScopeSchema.default("PERSON"),
    personIds: z.array(z.number().int().positive()).min(1).max(500).optional(),
  })
  .superRefine((value, context) => {
    if ((value.scope === "PERSON" || value.scope === "BATCH") && !value.personIds?.length) {
      context.addIssue({
        code: "custom",
        path: ["personIds"],
        message: "El alcance PERSON o BATCH requiere al menos un asociado.",
      });
    }
    if (value.scope === "FULL" && value.personIds?.length) {
      context.addIssue({
        code: "custom",
        path: ["personIds"],
        message: "El alcance FULL no debe recibir asociados explícitos.",
      });
    }
  });

export type StartQuotaSyncInput = z.infer<typeof startQuotaSyncSchema>;
