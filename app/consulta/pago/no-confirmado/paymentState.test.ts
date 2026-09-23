import { describe, expect, it } from "vitest";
import { getNiubizActionCode } from "@/modules/afiliaciones/payments/Services/Niubiz/NiubizActionCodes";
import { isMatchingFailedPayment } from "./paymentState";

describe("payment not confirmed state", () => {
  const reference = { applicationId: 42 };
  const failedPayment = { applicationId: 42, status: "FAILED" };

  it.each([
    [null, null, false],
    [null, reference, false],
    [failedPayment, null, false],
    [failedPayment, { applicationId: 43 }, false],
    [{ applicationId: 42, status: "PENDING" }, reference, false],
    [failedPayment, reference, true],
  ] as const)("handles missing or mismatched payment data safely", (payment, callbackReference, expected) => {
    expect(isMatchingFailedPayment(payment, callbackReference)).toBe(expected);
  });

  it("distinguishes known and unknown Niubiz action codes", () => {
    expect(getNiubizActionCode("101")?.userMessage).toBeTruthy();
    expect(getNiubizActionCode("UNKNOWN")).toBeUndefined();
  });
});
