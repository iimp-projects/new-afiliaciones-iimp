import { z } from "zod";
import { billingDataSchema } from "./billing.schema";

export const createPaymentSchema = z.object({
  applicationId: z.number().int().positive(),
  billingData: billingDataSchema,
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

