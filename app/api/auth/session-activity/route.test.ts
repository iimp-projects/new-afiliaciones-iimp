import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ getSessionIdFromJWT: vi.fn() }));
const service = vi.hoisted(() => ({ getSessionStatus: vi.fn(), registerActivity: vi.fn() }));
vi.mock("@/lib/config/env", () => ({ getAppBaseUrl: () => "https://afiliaciones-qa.iimp.org.pe" }));
vi.mock("@/modules/auth/context/adapter", () => ({ authAdapter: auth }));
vi.mock("@/modules/auth/session/service", () => ({ sessionService: service }));
import { POST } from "./route";

const valid = { valid: true, serverNow: new Date("2026-10-08T12:00:00Z"), expiresAt: new Date("2026-10-09T12:00:00Z"), lastActivityAt: new Date("2026-10-08T12:00:00Z"), effectiveExpiresAt: new Date("2026-10-08T12:30:00Z"), expiryReason: "IDLE" as const };
describe("POST /api/auth/session-activity", () => {
  beforeEach(() => vi.clearAllMocks());
  it("registra actividad solo desde el origen canónico", async () => {
    auth.getSessionIdFromJWT.mockResolvedValue("opaque"); service.registerActivity.mockResolvedValue(valid);
    const response = await POST(new Request("https://afiliaciones-qa.iimp.org.pe/api/auth/session-activity", { method: "POST", headers: { origin: "https://afiliaciones-qa.iimp.org.pe" } }));
    expect(response.status).toBe(200); expect(service.registerActivity).toHaveBeenCalledWith("opaque");
  });
  it("rechaza CSRF antes de consultar la sesión", async () => {
    const response = await POST(new Request("https://afiliaciones-qa.iimp.org.pe/api/auth/session-activity", { method: "POST", headers: { origin: "https://attacker.example" } }));
    expect(response.status).toBe(403); expect(auth.getSessionIdFromJWT).not.toHaveBeenCalled();
  });
  it("no renueva una sesión inexistente", async () => {
    auth.getSessionIdFromJWT.mockResolvedValue(null); service.getSessionStatus.mockReturnValue({ ...valid, valid: false, expiresAt: null, lastActivityAt: null, effectiveExpiresAt: null, expiryReason: null });
    const response = await POST(new Request("https://afiliaciones-qa.iimp.org.pe/api/auth/session-activity", { method: "POST", headers: { origin: "https://afiliaciones-qa.iimp.org.pe" } }));
    expect(response.status).toBe(401); expect(service.registerActivity).not.toHaveBeenCalled();
  });
});
