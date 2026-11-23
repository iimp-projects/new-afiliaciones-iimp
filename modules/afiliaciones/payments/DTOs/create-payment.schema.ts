import { z } from "zod";
import { billingDataSchema } from "./billing.schema";

export const createPaymentSchema = z.object({
  applicationId: z.number().int().positive(),
  billingData: billingDataSchema,
  billingConfirmed: z.boolean(),
  termsAccepted: z.boolean(),
  majorityAccepted: z.boolean(),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

