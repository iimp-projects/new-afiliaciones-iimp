import { describe, expect, it } from "vitest";
import { paymentOriginLabel, resolvePaymentOrigin } from "../Models/PaymentOrigin";

describe("PaymentOrigin", () => {
  it("clasifica como manual los pagos migrados con gateway BANK_TRANSFER", () => {
    expect(resolvePaymentOrigin({ status: "PAID", gateway: "BANK_TRANSFER" })).toBe("MANUAL");
    expect(paymentOriginLabel({ status: "PAID", gateway: "BANK_TRANSFER" })).toBe("Manual");
  });

  it("clasifica como manual los pagos con canal MANUAL", () => {
    expect(resolvePaymentOrigin({ status: "PAID", gateway: "NIUBIZ", paymentChannel: "MANUAL" })).toBe("MANUAL");
  });

  it("clasifica como manual los pagos con marca manual en gatewayPayload", () => {
    expect(resolvePaymentOrigin({ status: "PAID", gateway: "NIUBIZ", gatewayPayload: { manualPayment: true } })).toBe("MANUAL");
  });

  it("clasifica como pasarela los pagos Niubiz", () => {
    expect(resolvePaymentOrigin({ status: "PAID", gateway: "NIUBIZ", paymentChannel: "web" })).toBe("GATEWAY");
    expect(paymentOriginLabel({ status: "PAID", gateway: "NIUBIZ", paymentChannel: "web" })).toBe("Pasarela");
  });

  it("no asigna origen a pagos no aprobados o inexistentes", () => {
    expect(resolvePaymentOrigin({ status: "PENDING", gateway: "NIUBIZ" })).toBe("UNRESOLVED");
    expect(resolvePaymentOrigin(null)).toBe("UNRESOLVED");
    expect(paymentOriginLabel(undefined)).toBe("");
  });
});
