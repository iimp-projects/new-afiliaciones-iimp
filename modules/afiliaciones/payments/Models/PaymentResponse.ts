import type { PaymentStatus } from "./Payment";
import type { NiubizCheckoutConfig } from "../DTOs/Niubiz/NiubizCheckout.dto";

export interface CreatePaymentResponse {
  success: boolean;
  paymentId: number;
  status: PaymentStatus;
  transactionId?: string;
  authorizationCode?: string;
  responseCode?: string;
  amount: number;
  currency: "PEN";
  checkout?: NiubizCheckoutConfig;
  message: string;
}
