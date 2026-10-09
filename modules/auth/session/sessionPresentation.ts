export const SESSION_ACTIVITY_THROTTLE_MS = 5 * 60 * 1000;

export type SessionExpiryReason = "IDLE" | "ABSOLUTE" | null;

export interface SessionSnapshot {
  valid: boolean;
  serverNow: string;
  expiresAt: string | null;
  lastActivityAt: string | null;
  effectiveExpiresAt: string | null;
  expiryReason: SessionExpiryReason;
}

export function shouldRegisterHumanActivity(input: {
  isHumanActivity: boolean;
  isVisible: boolean;
  isPending: boolean;
  now: number;
  lastRequestAt: number;
}): boolean {
  return input.isHumanActivity && input.isVisible && !input.isPending && input.now - input.lastRequestAt >= SESSION_ACTIVITY_THROTTLE_MS;
}

export function getRemainingMs(snapshot: SessionSnapshot | null, serverOffsetMs: number, clientNow: number): number | null {
  if (!snapshot?.valid || !snapshot.effectiveExpiresAt) return null;
  return Math.max(0, Date.parse(snapshot.effectiveExpiresAt) - (clientNow + serverOffsetMs));
}
