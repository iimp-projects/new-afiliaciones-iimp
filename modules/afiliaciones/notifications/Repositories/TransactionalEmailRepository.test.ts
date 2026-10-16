import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const db = vi.hoisted(() => ({
  transactionalEmail: {} as {
    create: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: db }));

describe("TransactionalEmailRepository", () => {
  beforeEach(() => {
    db.transactionalEmail.create = vi.fn();
    db.transactionalEmail.findUnique = vi.fn();
    db.transactionalEmail.update = vi.fn();
  });

  it("creates a PENDING record with a stable idempotency key", async () => {
    db.transactionalEmail.create.mockResolvedValueOnce({ id: 1 });
    const { TransactionalEmailRepository } = await import("./TransactionalEmailRepository");
    const repo = new TransactionalEmailRepository();

    const result = await repo.createOrGetIdempotent({
      event: "APPLICATION_REJECTED",
      recipient: "postulante@example.com",
      idempotencyKey: "APPLICATION_REJECTED:1:postulante@example.com",
    });

    expect(result).toEqual({ id: 1, created: true });
    expect(db.transactionalEmail.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          recipient: "postulante@example.com",
          idempotencyKey: "APPLICATION_REJECTED:1:postulante@example.com",
        }),
      }),
    );
  });

  it("returns the existing record on idempotency key collision without duplicating", async () => {
    db.transactionalEmail.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("unique", { code: "P2002", clientVersion: "6.19.3", meta: { target: ["idempotency_key"] } }),
    );
    db.transactionalEmail.findUnique.mockResolvedValueOnce({ id: 7 });
    const { TransactionalEmailRepository } = await import("./TransactionalEmailRepository");
    const repo = new TransactionalEmailRepository();

    const result = await repo.createOrGetIdempotent({ recipient: "a@b.c", idempotencyKey: "K" });

    expect(result).toEqual({ id: 7, created: false });
  });

  it("marks ACCEPTED without claiming delivery to the recipient", async () => {
    db.transactionalEmail.update.mockResolvedValueOnce({});
    const { TransactionalEmailRepository } = await import("./TransactionalEmailRepository");
    const repo = new TransactionalEmailRepository();

    await repo.markAccepted(1, "msg-123");

    expect(db.transactionalEmail.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: expect.objectContaining({ status: "ACCEPTED", messageId: "msg-123" }),
      }),
    );
  });

  it("records failure and only requires attention when exhausted", async () => {
    db.transactionalEmail.update.mockResolvedValue({});
    const { TransactionalEmailRepository } = await import("./TransactionalEmailRepository");
    const repo = new TransactionalEmailRepository();

    await repo.recordFailure(1, "boom");
    expect(db.transactionalEmail.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "FAILED", requiresAttention: false }) }),
    );

    await repo.recordFailure(1, "boom", { exhausted: true });
    expect(db.transactionalEmail.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "EXHAUSTED", requiresAttention: true }) }),
    );
  });
});
