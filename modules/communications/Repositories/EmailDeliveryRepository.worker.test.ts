import { describe, expect, it, vi } from "vitest";
import { EmailSendStatus } from "@prisma/client";
import { EmailDeliveryRepository } from "./EmailDeliveryRepository";
import { SMTP_AUTH_ERROR_MESSAGE } from "@/modules/shared/Services/MailService";

function makeDb(overrides: { updateManyCount?: number; currentStatus?: EmailSendStatus } = {}) {
  const tx = {
    emailCampaignRecipient: {
      updateMany: vi.fn().mockResolvedValue({ count: overrides.updateManyCount ?? 0 }),
      findUnique: vi.fn().mockResolvedValue({ status: overrides.currentStatus ?? EmailSendStatus.PENDING }),
    },
    emailDelivery: {
      aggregate: vi.fn().mockResolvedValue({ _max: { attemptNumber: null } }),
      create: vi.fn().mockResolvedValue({ id: 99, attemptNumber: 1 }),
    },
  };
  const db = {
    $transaction: vi.fn((fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    emailCampaignRecipient: tx.emailCampaignRecipient,
    emailDelivery: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    $queryRaw: vi.fn().mockResolvedValue([]),
  };
  return { db, tx };
}

describe("EmailDeliveryRepository.claimRecipient", () => {
  it("reclama atómicamente PENDING → SENDING y crea el delivery", async () => {
    const { db, tx } = makeDb({ updateManyCount: 1 });
    const repository = new EmailDeliveryRepository(db as never);

    const result = await repository.claimRecipient(1, 7, "r@x.com");

    expect(result.claimed).toBe(true);
    expect(result.status).toBe(EmailSendStatus.SENDING);
    expect(result.delivery).toEqual({ id: 99, attemptNumber: 1 });
    expect(tx.emailCampaignRecipient.updateMany).toHaveBeenCalledWith({
      where: { campaignId: 1, recipientId: 7, status: EmailSendStatus.PENDING },
      data: { status: EmailSendStatus.SENDING },
    });
    expect(tx.emailDelivery.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ campaignId: 1, recipientId: 7, email: "r@x.com", status: EmailSendStatus.SENDING }) }),
    );
  });

  it("no reclama si ya no está PENDING (devuelve el estado actual)", async () => {
    const { db } = makeDb({ updateManyCount: 0, currentStatus: EmailSendStatus.SENT });
    const repository = new EmailDeliveryRepository(db as never);

    const result = await repository.claimRecipient(1, 7, "r@x.com");

    expect(result.claimed).toBe(false);
    expect(result.status).toBe(EmailSendStatus.SENT);
    expect(result.delivery).toBeUndefined();
  });
});

describe("EmailDeliveryRepository.countConsecutiveAuthErrors", () => {
  it("cuenta errores AUTH consecutivos hasta el primer error distinto", async () => {
    const { db } = makeDb();
    db.emailDelivery.findMany.mockResolvedValue([
      { errorMessage: SMTP_AUTH_ERROR_MESSAGE },
      { errorMessage: SMTP_AUTH_ERROR_MESSAGE },
      { errorMessage: SMTP_AUTH_ERROR_MESSAGE },
      { errorMessage: "El proveedor rechazó el correo de forma permanente." },
      { errorMessage: SMTP_AUTH_ERROR_MESSAGE },
    ]);
    const repository = new EmailDeliveryRepository(db as never);

    const result = await repository.countConsecutiveAuthErrors(1, 5);

    expect(result).toBe(3);
  });

  it("devuelve 0 sin errores AUTH", async () => {
    const { db } = makeDb();
    db.emailDelivery.findMany.mockResolvedValue([{ errorMessage: "Otra cosa." }]);
    const repository = new EmailDeliveryRepository(db as never);

    const result = await repository.countConsecutiveAuthErrors(1, 5);

    expect(result).toBe(0);
  });
});
