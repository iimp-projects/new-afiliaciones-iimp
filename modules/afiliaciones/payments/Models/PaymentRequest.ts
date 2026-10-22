import type { BillingDataInput } from "../DTOs/billing.schema";

export interface CreatePaymentRequest {
  applicationId: number;
  billingData: BillingDataInput;
  billingConfirmed: boolean;
  termsAccepted: boolean;
  majorityAccepted: boolean;
}

