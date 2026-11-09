import type { PaymentStatus } from "./Payment";
import type { NiubizCheckoutConfig } from "../DTOs/Niubiz/NiubizCheckout.dto";
import type { NiubizSessionDiagnostic } from "../DTOs/Niubiz/NiubizSessionDiagnostic.dto";

export interface CreatePaymentResponse {
  success: boolean;
  paymentId: number;
  status: PaymentStatus;
  transactionId?: string;
  authorizationCode?: string;
  responseCode?: string;
  amount: number;
  registrationAmount?: number | null;
  membershipFeeAmount?: number | null;
  currency: "PEN";
  checkout?: NiubizCheckoutConfig;
  diagnostic?: NiubizSessionDiagnostic;
  message: string;
}
