import type { BillingDataInput } from "../DTOs/billing.schema";

export interface CreatePaymentRequest {
  applicationId: number;
  billingData: BillingDataInput;
}

