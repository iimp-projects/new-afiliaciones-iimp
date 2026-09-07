import { PaymentGateway } from "@prisma/client";
import type { PaymentProvider, PaymentProviderCommand } from "./PaymentProvider";

export type MockPaymentScenario = "PAID" | "FAILED" | "PENDING";

export class MockPaymentProvider implements PaymentProvider {
  readonly gateway = PaymentGateway.MOCK;
  constructor(private readonly scenario: MockPaymentScenario = "PAID") {}

  assertReady(): void {}

  async initiate(command: PaymentProviderCommand) {
    const transactionId = `MOCK-TXN-${command.paymentId}`;

    if (this.scenario === "FAILED") {
      return { status: "FAILED" as const, transactionId, responseCode: "DEV_DECLINED" };
    }

    if (this.scenario === "PENDING") {
      return { status: "PENDING" as const, transactionId };
    }

    return {
      status: "PAID" as const,
      transactionId,
      authorizationCode: `DEV-AUTH-${Math.floor(Math.random() * 100000)}`,
      responseCode: "00",
    };
  }
}
