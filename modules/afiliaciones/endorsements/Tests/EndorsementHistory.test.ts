import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  membershipApproval: { findMany: vi.fn(), count: vi.fn() },
  membershipApplication: { count: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));

import { EndorsementHistoryRepository } from "../Repositories/EndorsementHistoryRepository";
import { EndorsementHistoryService } from "../Services/EndorsementHistoryService";

const row = (overrides: Record<string, unknown> = {}) => ({
  id: 12,
  status: "APPROVED",
  createdAt: new Date("2026-09-01T12:00:00.000Z"),
  application: {
    status: "READY_FOR_PAYMENT",
    applicationCode: "EXP-001",
    affiliateType: "ACTIVE",
    person: { firstName: "Ana", paternalLastName: "Pérez", maternalLastName: null },
  },
  ...overrides,
});

const service = () => new EndorsementHistoryService(new EndorsementHistoryRepository());

beforeEach(() => {
  vi.clearAllMocks();
  db.membershipApproval.findMany.mockResolvedValue([]);
  db.membershipApproval.count.mockResolvedValue(0);
  db.membershipApplication.count.mockResolvedValue(0);
});

describe("EndorsementHistoryService", () => {
  it("returns an empty history when the account has no linked person", async () => {
    db.user.findUnique.mockResolvedValue({ personId: null });

    const result = await service().getForUser(44, { page: 1, pageSize: 10 });

    expect(result.items).toEqual([]);
    expect(result.metrics).toEqual({ total: 0, approved: 0, inProcess: 0 });
    expect(result.totalItems).toBe(0);
    expect(db.membershipApproval.findMany).not.toHaveBeenCalled();
  });

  it("resolves only the authenticated user's own person and isolates by sponsorPersonId", async () => {
    db.user.findUnique.mockResolvedValue({ personId: 17 });
    db.membershipApproval.findMany.mockResolvedValue([row()]);
    db.membershipApproval.count.mockResolvedValue(1);

    await service().getForUser(99, { page: 1, pageSize: 10 });

    expect(db.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 99 } }));
    const where = db.membershipApproval.findMany.mock.calls[0][0].where;
    expect(where.sponsorPersonId).toBe(17);
    // Never scoped by email/contact data.
    expect(JSON.stringify(where)).not.toContain("@");
    // Single joined query: no N+1 per endorsement.
    expect(db.membershipApproval.findMany).toHaveBeenCalledTimes(1);
  });

  it("maps a row to display-only fields with the applicant's full name", async () => {
    db.user.findUnique.mockResolvedValue({ personId: 17 });
    db.membershipApproval.findMany.mockResolvedValue([row()]);
    db.membershipApproval.count.mockResolvedValue(1);

    const { items } = await service().getForUser(99, { page: 1, pageSize: 10 });

    expect(items).toEqual([
      {
        id: 12,
        applicantName: "Ana Pérez",
        affiliateType: "ACTIVE",
        endorsementStatus: "APPROVED",
        endorsementDate: "2026-09-01T12:00:00.000Z",
        applicationStatus: "READY_FOR_PAYMENT",
        applicationCode: "EXP-001",
      },
    ]);
  });

  it("computes the three indicators with distinct application counts", async () => {
    db.user.findUnique.mockResolvedValue({ personId: 17 });
    db.membershipApproval.count.mockResolvedValue(5);
    db.membershipApplication.count.mockResolvedValueOnce(2).mockResolvedValueOnce(3);

    const { metrics } = await service().getForUser(99, { page: 1, pageSize: 10 });

    expect(metrics).toEqual({ total: 5, approved: 2, inProcess: 3 });

    const [approvedWhere, inProcessWhere] = db.membershipApplication.count.mock.calls.map(
      (call) => call[0].where,
    );
    expect(approvedWhere.status.in).toEqual(["READY_FOR_PAYMENT", "COMPLETED"]);
    expect(inProcessWhere.status.in).toEqual([
      "PENDING",
      "UNDER_EVALUACION",
      "OBSERVED",
      "RESOLVED",
    ]);
    expect(approvedWhere.approvals.some.sponsorPersonId).toBe(17);
    expect(approvedWhere.deletedAt).toBeNull();
  });

  it("applies name, date and status filters and paginates", async () => {
    db.user.findUnique.mockResolvedValue({ personId: 17 });
    db.membershipApproval.findMany.mockResolvedValue([]);
    db.membershipApproval.count.mockResolvedValue(0);

    await service().getForUser(99, {
      page: 3,
      pageSize: 5,
      search: "ana",
      status: "OBSERVED",
      from: new Date("2026-09-01T00:00:00.000Z"),
      to: new Date("2026-09-30T23:59:59.999Z"),
    });

    const call = db.membershipApproval.findMany.mock.calls[0][0];
    expect(call.skip).toBe(10);
    expect(call.take).toBe(5);
    expect(call.where.sponsorPersonId).toBe(17);
    expect(call.where.application.is.status).toBe("OBSERVED");
    expect(call.where.application.is.deletedAt).toBeNull();
    expect(call.where.application.is.OR).toHaveLength(3);
    expect(call.where.createdAt.gte).toEqual(new Date("2026-09-01T00:00:00.000Z"));
    expect(call.where.createdAt.lte).toEqual(new Date("2026-09-30T23:59:59.999Z"));
  });
});
