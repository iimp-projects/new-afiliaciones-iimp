import { describe, expect, it, vi } from "vitest";
import { Prisma, UserStatus } from "@prisma/client";
import { CampaignRepository } from "../Repositories/CampaignRepository";

const ACTOR = { userId: 1, email: "admin@iimp.org.pe" };

function makeDb(recipients: Array<{ id: number; metadata: unknown }>, users: unknown[]) {
  const tx = {
    emailCampaignRecipient: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    emailRecipient: {
      findMany: vi.fn().mockResolvedValue(recipients),
    },
    user: {
      findMany: vi.fn().mockResolvedValue(users),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({}),
    },
  };
  const db = {
    $transaction: vi.fn((fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
  };
  return { db, tx };
}

describe("CampaignRepository.setCampaignRecipients", () => {
  it("reconstruye el snapshot completo desde EmailRecipient.metadata (asociado) y deja null el manual", async () => {
    const { db, tx } = makeDb(
      [
        { id: 101, metadata: { source: "associates", userId: 1332, personId: 3548, tipoAsociado: "ESTUDIANTE", documentNumber: "73136694" } },
        { id: 202, metadata: null },
      ],
      [
        {
          id: 1332,
          email: "111683@unsaac.edu.pe",
          status: UserStatus.ACTIVE,
          role: { slug: "ASOCIADO_ESTUDIANTE" },
          person: { id: 3548, firstName: "RUTH NERY", paternalLastName: "HUARCO", maternalLastName: "GUTIERREZ", documentNumber: "73136694" },
        },
      ],
    );

    const repository = new CampaignRepository(db as never);
    await repository.setCampaignRecipients(1, [101, 202], ACTOR, "Campaña");

    expect(tx.emailCampaignRecipient.deleteMany).toHaveBeenCalledWith({ where: { campaignId: 1 } });
    const call = tx.emailCampaignRecipient.createMany.mock.calls[0][0] as {
      data: Array<{ recipientId: number; status: unknown; metadata: unknown }>;
    };
    expect(call.data).toHaveLength(2);
    const byRecipient = new Map(call.data.map((row) => [row.recipientId, row]));

    expect(byRecipient.get(101)?.metadata).toEqual({
      source: "associates",
      userId: 1332,
      personId: 3548,
      nombreCompleto: "RUTH NERY HUARCO GUTIERREZ",
      correoAcceso: "111683@unsaac.edu.pe",
      tipoAsociado: "ESTUDIANTE",
      accountStatus: "ACTIVE",
      documentNumber: "73136694",
    });
    expect(byRecipient.get(202)?.metadata).toBe(Prisma.DbNull);
  });

  it("no copia snapshot si el asociado vinculado ya no existe", async () => {
    const { db, tx } = makeDb(
      [{ id: 101, metadata: { source: "associates", userId: 9999 } }],
      [],
    );

    const repository = new CampaignRepository(db as never);
    await repository.setCampaignRecipients(1, [101], ACTOR, "Campaña");

    const call = tx.emailCampaignRecipient.createMany.mock.calls[0][0] as {
      data: Array<{ recipientId: number; metadata: unknown }>;
    };
    expect(call.data[0].metadata).toBe(Prisma.DbNull);
  });

  it("sin destinatarios no consulta identidades y no llama createMany", async () => {
    const { db, tx } = makeDb([], []);

    const repository = new CampaignRepository(db as never);
    await repository.setCampaignRecipients(1, [], ACTOR, "Campaña");

    expect(tx.emailRecipient.findMany).not.toHaveBeenCalled();
    expect(tx.emailCampaignRecipient.createMany).not.toHaveBeenCalled();
    expect(tx.auditLog.create).toHaveBeenCalled();
  });
});
