import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ notification: {} as { createMany: ReturnType<typeof vi.fn> } }));

vi.mock("@/lib/prisma", () => ({ prisma: db }));

describe("NotificationDispatcherService", () => {
  beforeEach(() => {
    db.notification.createMany = vi.fn(async () => ({ count: 0 }));
  });

  it("creates one row per recipient with a stable per-recipient dedup key", async () => {
    const { NotificationDispatcherService } = await import("./NotificationDispatcherService");
    const dispatcher = new NotificationDispatcherService();

    await dispatcher.dispatch({
      type: "APPLICATION_SUBMITTED",
      title: "Nuevo expediente",
      message: "Revisar",
      dedupBaseKey: "APPLICATION_SUBMITTED:1",
      recipientUserIds: [10, 20],
    });

    const call = db.notification.createMany.mock.calls[0][0];
    expect(call.data).toHaveLength(2);
    expect(call.data.map((d: { dedupKey: string }) => d.dedupKey)).toEqual([
      "APPLICATION_SUBMITTED:1:10",
      "APPLICATION_SUBMITTED:1:20",
    ]);
    expect(call.skipDuplicates).toBe(true);
  });

  it("does not persist when there are no recipients", async () => {
    const { NotificationDispatcherService } = await import("./NotificationDispatcherService");
    const dispatcher = new NotificationDispatcherService();

    const result = await dispatcher.dispatch({
      type: "T",
      title: "t",
      message: "m",
      dedupBaseKey: "X",
      recipientUserIds: [],
    });

    expect(result).toBe(0);
    expect(db.notification.createMany).not.toHaveBeenCalled();
  });

  it("does not block two legitimate events of the same type", async () => {
    const { NotificationDispatcherService } = await import("./NotificationDispatcherService");
    const dispatcher = new NotificationDispatcherService();

    await dispatcher.dispatch({ type: "CORRECTION_SUBMITTED", title: "t", message: "m", dedupBaseKey: "CORRECTION_SUBMITTED:1:100", recipientUserIds: [10] });
    await dispatcher.dispatch({ type: "CORRECTION_SUBMITTED", title: "t", message: "m", dedupBaseKey: "CORRECTION_SUBMITTED:1:101", recipientUserIds: [10] });

    const first = db.notification.createMany.mock.calls[0][0].data[0].dedupKey;
    const second = db.notification.createMany.mock.calls[1][0].data[0].dedupKey;
    expect(first).toBe("CORRECTION_SUBMITTED:1:100:10");
    expect(second).toBe("CORRECTION_SUBMITTED:1:101:10");
  });
});
