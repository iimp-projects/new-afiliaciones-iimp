import { beforeEach, describe, expect, it, vi } from "vitest";

const repository = vi.hoisted(() => ({ create: vi.fn(), findById: vi.fn(), updateActivity: vi.fn(), updateExpiration: vi.fn(), revoke: vi.fn(), revokeAllByUserId: vi.fn(), deleteExpired: vi.fn() }));
vi.mock("./repository", () => ({ sessionRepository: repository }));
vi.mock("../errors", () => ({ SessionError: class SessionError extends Error {} }));

import { SESSION_IDLE_TIMEOUT_MS, SessionService } from "./service";
import type { SessionDTO } from "./types";

const now = new Date("2026-10-08T12:00:00.000Z");
const session = (overrides: Partial<SessionDTO> = {}): SessionDTO => ({ id: "opaque", userId: 1, ipAddress: null, userAgent: null, os: null, browser: null, expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000), lastActivityAt: new Date(now.getTime() - 5 * 60 * 1000 - 1), isRevoked: false, revokedAt: null, revokeReason: null, createdAt: now, updatedAt: now, ...overrides });

describe("SessionService session status", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(now); });
  it("calcula vencimiento por inactividad sin mutar", () => {
    const result = new SessionService().getSessionStatus(session());
    expect(result).toMatchObject({ valid: true, expiryReason: "IDLE", effectiveExpiresAt: new Date(session().lastActivityAt.getTime() + SESSION_IDLE_TIMEOUT_MS) });
  });
  it("prioriza el límite absoluto de 24 horas", () => {
    const value = session({ expiresAt: new Date(now.getTime() + 60_000) });
    expect(new SessionService().getSessionStatus(value)).toMatchObject({ valid: true, expiryReason: "ABSOLUTE", effectiveExpiresAt: value.expiresAt });
  });
  it("rechaza sesiones revocadas y vencidas por inactividad", () => {
    expect(new SessionService().getSessionStatus(session({ isRevoked: true })).valid).toBe(false);
    expect(new SessionService().getSessionStatus(session({ lastActivityAt: new Date(now.getTime() - SESSION_IDLE_TIMEOUT_MS - 1) })).valid).toBe(false);
  });
  it("registra actividad solo después del throttle y nunca toca expiresAt", async () => {
    const value = session(); repository.findById.mockResolvedValue(value); repository.updateActivity.mockResolvedValue({ ...value, lastActivityAt: now });
    const result = await new SessionService().registerActivity(value.id);
    expect(repository.updateActivity).toHaveBeenCalledWith(value.id, now);
    expect(result.expiresAt).toEqual(value.expiresAt);
  });
  it("no actualiza una sesión revocada", async () => {
    repository.findById.mockResolvedValue(session({ isRevoked: true }));
    expect((await new SessionService().registerActivity("opaque")).valid).toBe(false);
    expect(repository.updateActivity).not.toHaveBeenCalled();
  });
});
