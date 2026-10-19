import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ user: { findMany: vi.fn() } }));

vi.mock("@/lib/prisma", () => ({ prisma: db }));

describe("NotificationRecipientResolver", () => {
  beforeEach(() => {
    db.user.findMany.mockReset();
  });

  it("resolves only ACTIVE users whose role manages the area (plus authorized admins)", async () => {
    db.user.findMany.mockResolvedValueOnce([{ id: 1 }, { id: 2 }]);

    const { NotificationRecipientResolver } = await import("./NotificationRecipientResolver");
    const resolver = new NotificationRecipientResolver();
    const ids = await resolver.resolveForDepartments(["LOGISTICA"]);

    expect(ids).toEqual([1, 2]);
    expect(db.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "ACTIVE",
          role: expect.objectContaining({
            slug: expect.objectContaining({ in: expect.arrayContaining(["LOGISTICA", "SUPER_ADMIN", "SYSTEM_ADMIN"]) }),
          }),
        }),
      }),
    );
  });

  it("returns an empty list for an empty department set without querying", async () => {
    const { NotificationRecipientResolver } = await import("./NotificationRecipientResolver");
    const resolver = new NotificationRecipientResolver();
    const ids = await resolver.resolveForDepartments([]);
    expect(ids).toEqual([]);
    expect(db.user.findMany).not.toHaveBeenCalled();
  });
});
