import { describe, expect, it, vi } from "vitest";
import { EmailSendStatus } from "@prisma/client";
import { EmailDeliveryRepository } from "./EmailDeliveryRepository";
import { SMTP_AUTH_ERROR_MESSAGE } from "@/modules/shared/Services/MailService";

function makeDb() {
  return {
    emailCampaignRecipient: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      findUnique: vi.fn().mockResolvedValue({ status: EmailSendStatus.PENDING }),
    },
    emailDelivery: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    $queryRaw: vi.fn().mockResolvedValue([]),
  };
}

describe("EmailDeliveryRepository.claimRecipient", () => {
  it("reclama atómicamente PENDING → SENDING", async () => {
    const db = makeDb();
    db.emailCampaignRecipient.updateMany.mockResolvedValue({ count: 1 });
    const repository = new EmailDeliveryRepository(db as never);

    const result = await repository.claimRecipient(1, 7);

    expect(result.claimed).toBe(true);
    expect(result.status).toBe(EmailSendStatus.SENDING);
    expect(db.emailCampaignRecipient.updateMany).toHaveBeenCalledWith({
      where: { campaignId: 1, recipientId: 7, status: EmailSendStatus.PENDING },
      data: { status: EmailSendStatus.SENDING },
    });
  });

  it("no reclama si ya no está PENDING (devuelve el estado actual)", async () => {
    const db = makeDb();
    db.emailCampaignRecipient.updateMany.mockResolvedValue({ count: 0 });
    db.emailCampaignRecipient.findUnique.mockResolvedValue({ status: EmailSendStatus.SENT });
    const repository = new EmailDeliveryRepository(db as never);

    const result = await repository.claimRecipient(1, 7);

    expect(result.claimed).toBe(false);
    expect(result.status).toBe(EmailSendStatus.SENT);
  });
});

describe("EmailDeliveryRepository.countConsecutiveAuthErrors", () => {
  it("cuenta errores AUTH consecutivos hasta el primer error distinto", async () => {
    const db = makeDb();
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
    const db = makeDb();
    db.emailDelivery.findMany.mockResolvedValue([{ errorMessage: "Otra cosa." }]);
    const repository = new EmailDeliveryRepository(db as never);

    const result = await repository.countConsecutiveAuthErrors(1, 5);

    expect(result).toBe(0);
  });
});
