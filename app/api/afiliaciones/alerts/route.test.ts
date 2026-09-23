import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ requirePermission: vi.fn(), synchronize: vi.fn(), list: vi.fn() }));
class TestAuthenticationError extends Error {}
class TestAuthorizationError extends Error {}
vi.mock("@/modules/auth/context/service", () => ({ contextService: { requirePermission: state.requirePermission } }));
vi.mock("@/modules/auth/errors", () => ({ AuthenticationError: TestAuthenticationError, AuthorizationError: TestAuthorizationError }));
vi.mock("@/modules/afiliaciones/alerts/Services/OperationalAlertTrackingService", () => ({ operationalAlertTrackingService: { synchronize: state.synchronize, list: state.list } }));

describe("GET /api/afiliaciones/alerts", () => {
  beforeEach(() => { state.requirePermission.mockReset(); state.synchronize.mockReset(); state.list.mockReset(); });
  it("rejects unauthenticated or unauthorized access using the route's current 403 contract", async () => { state.requirePermission.mockRejectedValue(new TestAuthenticationError("denied")); const { GET } = await import("./route"); const response = await GET(); expect(response.status).toBe(403); expect(await response.json()).toEqual({ message: "No autorizado." }); expect(state.synchronize).not.toHaveBeenCalled(); });
  it("authorizes, reads persisted alerts without synchronizing, and preserves the summary contract", async () => { const order: string[] = []; state.requirePermission.mockImplementation(async () => { order.push("permission"); }); state.list.mockImplementation(async () => { order.push("list"); return { total: 25, critical: 10, warning: 15, alerts: Array.from({ length: 20 }, (_, id) => ({ id })) }; }); const { GET } = await import("./route"); const response = await GET(); expect(order).toEqual(["permission", "list"]); expect(state.synchronize).not.toHaveBeenCalled(); expect(response.status).toBe(200); expect(await response.json()).toEqual({ total: 25, critical: 10, warning: 15, alerts: Array.from({ length: 20 }, (_, id) => ({ id })) }); });
});
