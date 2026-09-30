import { describe, expect, it, vi } from "vitest";
import { EmailSendStatus } from "@prisma/client";
import { EmailDeliveryRepository, STALE_DELIVERY_ERROR_MESSAGE, DELIVERY_STALE_TIMEOUT_MINUTES } from "../Repositories/EmailDeliveryRepository";

function makeDb(overrides: Record<string, unknown> = {}) {
  return {
    emailDelivery: {
      count: vi.fn().mockResolvedValue(0),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      aggregate: vi.fn().mockResolvedValue({ _max: { attemptNumber: null } }),
      create: vi.fn().mockResolvedValue({ id: 99, attemptNumber: 1 }),
      ...(overrides.emailDelivery as object | undefined),
    },
    emailCampaignRecipient: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      ...(overrides.emailCampaignRecipient as object | undefined),
    },
  };
}

describe("EmailDeliveryRepository.recoverStaleDeliveries", () => {
  it("marca delivery atascado como ERROR y sincroniza recipient a ERROR", async () => {
    const db = makeDb();
    db.emailDelivery.updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const repository = new EmailDeliveryRepository(db as never);

    await repository.recoverStaleDeliveries(1, 7);

    expect(db.emailDelivery.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: EmailSendStatus.ERROR, errorMessage: STALE_DELIVERY_ERROR_MESSAGE },
      }),
    );
    expect(db.emailCampaignRecipient.updateMany).toHaveBeenCalledWith({
      where: { campaignId: 1, recipientId: 7 },
      data: { status: EmailSendStatus.ERROR },
    });
  });

  it("conserva sendCount y lastSentAt (no los toca al recuperar)", async () => {
    const db = makeDb();
    db.emailDelivery.updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const repository = new EmailDeliveryRepository(db as never);

    await repository.recoverStaleDeliveries(1, 7);

    const recipientUpdate = db.emailCampaignRecipient.updateMany.mock.calls[0][0];
    expect(recipientUpdate.data).toEqual({ status: EmailSendStatus.ERROR });
    expect(recipientUpdate.data).not.toHaveProperty("sendCount");
    expect(recipientUpdate.data).not.toHaveProperty("lastSentAt");
  });

  it("aplica el cutoff de antigüedad configurable", async () => {
    const db = makeDb();
    db.emailDelivery.updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const repository = new EmailDeliveryRepository(db as never);
    const before = Date.now();

    await repository.recoverStaleDeliveries(1, 7);

    const where = db.emailDelivery.updateMany.mock.calls[0][0].where;
    expect(where.status).toEqual({ in: [EmailSendStatus.PENDING, EmailSendStatus.SENDING] });
    const cutoff = where.createdAt.lt as Date;
    const elapsedMinutes = (before - cutoff.getTime()) / 60_000;
    expect(elapsedMinutes).toBeGreaterThanOrEqual(DELIVERY_STALE_TIMEOUT_MINUTES - 1);
    expect(elapsedMinutes).toBeLessThanOrEqual(DELIVERY_STALE_TIMEOUT_MINUTES + 1);
  });

  it("sin deliveries atascados no toca al recipient", async () => {
    const db = makeDb();
    db.emailDelivery.updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const repository = new EmailDeliveryRepository(db as never);

    await repository.recoverStaleDeliveries(1, 7);

    expect(db.emailCampaignRecipient.updateMany).not.toHaveBeenCalled();
  });
});

describe("EmailDeliveryRepository.hasInFlightDelivery", () => {
  it("detecta PENDING/SENDING activos", async () => {
    const db = makeDb();
    db.emailDelivery.count = vi.fn().mockResolvedValue(1);
    const repository = new EmailDeliveryRepository(db as never);

    await expect(repository.hasInFlightDelivery(1, 7)).resolves.toBe(true);
    expect(db.emailDelivery.count).toHaveBeenCalledWith({
      where: { campaignId: 1, recipientId: 7, status: { in: [EmailSendStatus.PENDING, EmailSendStatus.SENDING] } },
    });
  });
});

describe("EmailDeliveryRepository.createPendingDelivery", () => {
  it("calcula attemptNumber como max+1", async () => {
    const db = makeDb();
    db.emailDelivery.aggregate = vi.fn().mockResolvedValue({ _max: { attemptNumber: 3 } });
    const repository = new EmailDeliveryRepository(db as never);

    await repository.createPendingDelivery(1, 7, "juan@empresa.com");

    expect(db.emailDelivery.create).toHaveBeenCalledWith({
      data: { campaignId: 1, recipientId: 7, email: "juan@empresa.com", status: EmailSendStatus.PENDING, attemptNumber: 4 },
      select: { id: true, attemptNumber: true },
    });
  });
});
