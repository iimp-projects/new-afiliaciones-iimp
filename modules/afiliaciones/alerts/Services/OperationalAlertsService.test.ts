import { beforeEach, describe, expect, it, vi } from "vitest";
import { OPERATIONAL_ALERTS_CUTOFF_DATE } from "../Config/operationalAlerts.config";

const db = vi.hoisted(() => ({ membershipApplication: { findMany: vi.fn() }, user: { findMany: vi.fn() }, payment: { findMany: vi.fn() } }));
vi.mock("@/lib/prisma", () => ({ prisma: db }));

describe("OperationalAlertsService cutoff", () => {
  beforeEach(() => { db.membershipApplication.findMany.mockReset().mockResolvedValue([]); db.user.findMany.mockReset().mockResolvedValue([]); db.payment.findMany.mockReset().mockResolvedValue([]); });

  it("filters portal, activation and SIE candidates at the exact application creation cutoff", async () => {
    const { OperationalAlertsService } = await import("./OperationalAlertsService");
    await new OperationalAlertsService().detectAll();
    expect(db.membershipApplication.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ createdAt: { gte: OPERATIONAL_ALERTS_CUTOFF_DATE } }) }));
    expect(OPERATIONAL_ALERTS_CUTOFF_DATE.getTime()).toBe(new Date("2026-09-01T00:00:00").getTime());
  });

  it("filters failed payments by their application creation date, not by payment date", async () => {
    const { OperationalAlertsService } = await import("./OperationalAlertsService");
    await new OperationalAlertsService().detectAll();
    expect(db.payment.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ application: expect.objectContaining({ createdAt: { gte: OPERATIONAL_ALERTS_CUTOFF_DATE } }) }) }));
  });

  it("replaces a portal conflict with the current activation-pending condition after access is provisioned", async () => {
    const base = { id: 10, applicationCode: "APP-10", email: "legacy@example.com", updatedAt: new Date(), personId: 2, associateIntegration: null };
    db.membershipApplication.findMany.mockResolvedValueOnce([{ ...base, person: { firstName: "Ana", paternalLastName: "Prueba", contacts: [{ email: "legacy@example.com" }], user: null } }]);
    db.user.findMany.mockResolvedValueOnce([{ id: 80, email: "legacy@example.com", personId: 9 }]);
    const { OperationalAlertsService } = await import("./OperationalAlertsService");
    await expect(new OperationalAlertsService().detectAll()).resolves.toEqual(expect.arrayContaining([expect.objectContaining({ type: "PORTAL_ACCESS_CONFLICT", applicationId: 10 })]));

    db.membershipApplication.findMany.mockResolvedValueOnce([{ ...base, person: { firstName: "Ana", paternalLastName: "Prueba", contacts: [{ email: "new@example.com" }], user: { id: 50, status: "PENDING", createdAt: new Date(), credentials: [] } } }]);
    db.user.findMany.mockResolvedValueOnce([]);
    const alerts = await new OperationalAlertsService().detectAll();
    expect(alerts).toEqual(expect.arrayContaining([expect.objectContaining({ type: "ACTIVATION_PENDING", applicationId: 10 })]));
    expect(alerts).not.toEqual(expect.arrayContaining([expect.objectContaining({ type: "PORTAL_ACCESS_CONFLICT", applicationId: 10 })]));
  });
});
