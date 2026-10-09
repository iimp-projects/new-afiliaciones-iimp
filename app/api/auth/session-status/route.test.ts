import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ getSessionIdFromJWT: vi.fn() }));
const service = vi.hoisted(() => ({ getSessionById: vi.fn(), getSessionStatus: vi.fn() }));
vi.mock("@/modules/auth/context/adapter", () => ({ authAdapter: auth }));
vi.mock("@/modules/auth/session/service", () => ({ sessionService: service }));
import { GET } from "./route";

const status = { valid: true, serverNow: new Date("2026-10-08T12:00:00Z"), expiresAt: new Date("2026-10-09T12:00:00Z"), lastActivityAt: new Date("2026-10-08T11:55:00Z"), effectiveExpiresAt: new Date("2026-10-08T12:25:00Z"), expiryReason: "IDLE" as const };
describe("GET /api/auth/session-status", () => {
  beforeEach(() => { vi.clearAllMocks(); service.getSessionStatus.mockReturnValue(status); });
  it("devuelve solo metadatos de tiempo sin tocar actividad", async () => {
    auth.getSessionIdFromJWT.mockResolvedValue("opaque"); service.getSessionById.mockResolvedValue({ id: "opaque" });
    const response = await GET(); const body = await response.json();
    expect(response.status).toBe(200); expect(body).toMatchObject({ valid: true, effectiveExpiresAt: status.effectiveExpiresAt.toISOString(), expiryReason: "IDLE" });
    expect(service.getSessionById).toHaveBeenCalledWith("opaque");
  });
  it("responde 401 si Auth.js no aporta una sesión", async () => {
    auth.getSessionIdFromJWT.mockResolvedValue(null);
    const response = await GET(); expect(response.status).toBe(401);
  });
});
