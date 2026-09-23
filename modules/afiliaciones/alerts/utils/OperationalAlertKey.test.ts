import { describe, expect, it } from "vitest";
import { buildOperationalAlertKey } from "./OperationalAlertKey";

describe("buildOperationalAlertKey", () => {
  it.each([
    ["PORTAL_ACCESS_CONFLICT", 165682, undefined, "PORTAL_ACCESS_CONFLICT:165682"],
    ["PORTAL_ACCESS_NOT_PROVISIONED", 165682, undefined, "PORTAL_ACCESS_NOT_PROVISIONED:165682"],
    ["ACTIVATION_PENDING", 165682, undefined, "ACTIVATION_PENDING:165682"],
    ["ACTIVATION_STALE", 165682, undefined, "ACTIVATION_STALE:165682"],
    ["SIE_SYNC_FAILED", 165682, 9, "SIE_SYNC_FAILED:165682:9"],
    ["SIE_PENDING", 165682, 9, "SIE_PENDING:165682:9"],
    ["PAYMENT_FAILURE", 165682, 56966, "PAYMENT_FAILURE:165682:56966"],
  ])("builds %s deterministically", (type, applicationId, relatedId, expected) => {
    expect(buildOperationalAlertKey(type, applicationId, relatedId)).toBe(expected);
    expect(buildOperationalAlertKey(type, applicationId, relatedId)).toBe(expected);
  });

  it("distinguishes persistent SIE and payment identifiers without sensitive data", () => {
    expect(buildOperationalAlertKey("SIE_PENDING", 1, 2)).not.toBe(buildOperationalAlertKey("SIE_PENDING", 1, 3));
    expect(buildOperationalAlertKey("PAYMENT_FAILURE", 1, 2)).not.toBe(buildOperationalAlertKey("PAYMENT_FAILURE", 1, 3));
  });
});
