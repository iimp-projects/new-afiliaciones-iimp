import type { CreatePaymentInput } from "../DTOs/create-payment.schema";
import type { PaymentGatewayResult } from "../Repositories/Interfaces/IPaymentRepository";
import type { PaymentGateway } from "@prisma/client";

export interface PaymentProviderCommand {
  paymentId: number;
  applicationId: number;
  billingData: CreatePaymentInput["billingData"];
  amount: number;
  currency: "PEN";
  customer: {
    email: string;
    firstName?: string;
    lastName?: string;
    clientIp?: string;
    phone?: string;
    personId?: number;
    documentNumber?: string;
  };
}

export interface PaymentProvider {
  readonly gateway: PaymentGateway;
  assertReady(): void;
  initiate(command: PaymentProviderCommand): Promise<PaymentGatewayResult>;
}
