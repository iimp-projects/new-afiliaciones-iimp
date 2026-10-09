import { describe, expect, it } from "vitest";
import { getRemainingMs, shouldRegisterHumanActivity, SESSION_ACTIVITY_THROTTLE_MS, type SessionSnapshot } from "./sessionPresentation";

const snapshot: SessionSnapshot = { valid: true, serverNow: "2026-10-08T12:00:00.000Z", expiresAt: "2026-10-09T12:00:00.000Z", lastActivityAt: "2026-10-08T12:00:00.000Z", effectiveExpiresAt: "2026-10-08T12:30:00.000Z", expiryReason: "IDLE" };

describe("session presentation activity gate", () => {
  const base = { isVisible: true, isPending: false, now: SESSION_ACTIVITY_THROTTLE_MS, lastRequestAt: 0 };
  it("does not register initial mount, focus, visibility or automatic navigation", () => {
    expect(shouldRegisterHumanActivity({ ...base, isHumanActivity: false })).toBe(false);
  });
  it("registers a real human interaction after the throttle", () => {
    expect(shouldRegisterHumanActivity({ ...base, isHumanActivity: true })).toBe(true);
  });
  it("does not register a human interaction before the throttle or while a request is pending", () => {
    expect(shouldRegisterHumanActivity({ ...base, isHumanActivity: true, now: SESSION_ACTIVITY_THROTTLE_MS - 1 })).toBe(false);
    expect(shouldRegisterHumanActivity({ ...base, isHumanActivity: true, isPending: true })).toBe(false);
  });
  it("calculates the countdown from server time without polling", () => {
    expect(getRemainingMs(snapshot, 5_000, Date.parse("2026-10-08T12:00:00.000Z"))).toBe(1_795_000);
    expect(getRemainingMs(snapshot, 0, Date.parse("2026-10-08T12:31:00.000Z"))).toBe(0);
  });
});
