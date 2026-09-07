import { z } from "zod";

export const authorizePaymentSchema = z.object({
  applicationId: z.number().int().positive(),
  paymentId: z.number().int().positive(),
  transactionToken: z.string().trim().min(1).max(500),
});

export type AuthorizePaymentInput = z.infer<typeof authorizePaymentSchema>;
