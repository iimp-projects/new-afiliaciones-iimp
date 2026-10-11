import { describe, expect, it, vi } from "vitest";
import { Prisma, PrismaClient } from "@prisma/client";
import {
  issueCard,
  newVerificationToken,
  regenerateCard,
  resolveCardData,
  revokeCard,
  CardError,
} from "../Services/cardData";

type PersonRow = {
  firstName: string;
  paternalLastName: string;
  maternalLastName: string | null;
  user: { image: string | null } | null;
  applications: Array<{
    status: string;
    affiliateType: "ACTIVE" | "STUDENT";
    documents: Array<{ mimeType: string; category: string | null; fileName: string | null; fileUrl: string }>;
    associateIntegration: { status: string; externalAssociateCode: number | null } | null;
  }>;
  sieAssociateRecords: Array<{
    externalCode: string;
    category: { mappedAffiliateType: "ACTIVE" | "STUDENT" | null; name: string } | null;
  }>;
};

function buildDb(overrides: { person?: PersonRow | null; card?: unknown } = {}) {
  const db = {
    person: { findUnique: vi.fn().mockResolvedValue(overrides.person ?? null) },
    associateCard: {
      findUnique: vi.fn().mockResolvedValue(overrides.card ?? null),
      create: vi.fn(),
      update: vi.fn(),
    },
  };
  return db as unknown as PrismaClient;
}

const completedSyncedApplication = {
  status: "COMPLETED",
  affiliateType: "ACTIVE" as const,
  documents: [],
  associateIntegration: { status: "SYNCED", externalAssociateCode: 12345 },
};

describe("resolveCardData", () => {
  it("es elegible para un asociado nuevo con postulación COMPLETED y SIE SYNCED", async () => {
    const person: PersonRow = {
      firstName: "María", paternalLastName: "Pérez", maternalLastName: "López",
      user: { image: null },
      applications: [completedSyncedApplication],
      sieAssociateRecords: [],
    };
    const result = await resolveCardData(1, buildDb({ person }));
    expect(result.eligible).toBe(true);
    expect(result.source).toBe("NEW");
    expect(result.code).toBe("12345");
    expect(result.category).toBe("Asociado Activo");
    expect(result.notFound).toBe(false);
  });

  it("es elegible para un asociado migrado con registro SIE LINKED y categoría permitida", async () => {
    const person: PersonRow = {
      firstName: "Juan", paternalLastName: "García", maternalLastName: null,
      user: { image: null },
      applications: [],
      sieAssociateRecords: [
        { externalCode: "999", category: { mappedAffiliateType: "STUDENT", name: "Estudiante" } },
      ],
    };
    const result = await resolveCardData(1, buildDb({ person }));
    expect(result.eligible).toBe(true);
    expect(result.source).toBe("MIGRATED");
    expect(result.code).toBe("999");
    expect(result.category).toBe("Asociado Estudiante");
  });

  it("no es elegible si el código institucional no fue confirmado por SIE", async () => {
    const person: PersonRow = {
      firstName: "Ana", paternalLastName: "Ruiz", maternalLastName: null,
      user: { image: null },
      applications: [
        {
          status: "COMPLETED",
          affiliateType: "ACTIVE",
          documents: [],
          associateIntegration: { status: "PENDING", externalAssociateCode: null },
        },
      ],
      sieAssociateRecords: [],
    };
    const result = await resolveCardData(1, buildDb({ person }));
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain("SIE");
    expect(result.code).toBeNull();
  });

  it("no es elegible para categorías institucionales no permitidas", async () => {
    const person: PersonRow = {
      firstName: "Luis", paternalLastName: "Torres", maternalLastName: null,
      user: { image: null },
      applications: [],
      sieAssociateRecords: [
        { externalCode: "888", category: { mappedAffiliateType: null, name: "Vitalicio" } },
      ],
    };
    const result = await resolveCardData(1, buildDb({ person }));
    expect(result.eligible).toBe(false);
    expect(result.reason).toContain("Categoría");
  });

  it("marca notFound si la persona no existe", async () => {
    const result = await resolveCardData(1, buildDb({ person: null }));
    expect(result.notFound).toBe(true);
    expect(result.eligible).toBe(false);
  });

  it("no crea registros (solo lectura)", async () => {
    const db = buildDb({
      person: {
        firstName: "X", paternalLastName: "Y", maternalLastName: null,
        user: { image: null }, applications: [], sieAssociateRecords: [],
      },
    });
    await resolveCardData(1, db);
    expect((db as unknown as { associateCard: { create: ReturnType<typeof vi.fn> } }).associateCard.create).not.toHaveBeenCalled();
  });
});

describe("issueCard", () => {
  it("crea y devuelve un token estable", async () => {
    const db = buildDb();
    const create = vi.fn().mockResolvedValue({ verificationToken: "tok1", status: "ISSUED" });
    (db as unknown as { associateCard: { create: typeof create } }).associateCard.create = create;
    const first = await issueCard(1, db);
    expect(first.verificationToken).toBe("tok1");
    expect(create).toHaveBeenCalledTimes(1);

    // Segunda llamada: ya existe ISSUED, no crea de nuevo.
    (db as unknown as { associateCard: { findUnique: typeof vi.fn } }).associateCard.findUnique = vi
      .fn()
      .mockResolvedValue({ verificationToken: "tok1", status: "ISSUED" });
    const second = await issueCard(1, db);
    expect(second.verificationToken).toBe("tok1");
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("maneja la carrera P2002 devolviendo el registro existente", async () => {
    const db = buildDb();
    const create = vi.fn().mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("unique", { code: "P2002", clientVersion: "6" }),
    );
    (db as unknown as { associateCard: { create: typeof create } }).associateCard.create = create;
    (db as unknown as { associateCard: { findUnique: typeof vi.fn } }).associateCard.findUnique = vi
      .fn()
      .mockResolvedValue({ verificationToken: "raced", status: "ISSUED" });
    const result = await issueCard(1, db);
    expect(result.verificationToken).toBe("raced");
  });

  it("no reactiva una credencial revocada", async () => {
    const db = buildDb({ card: { verificationToken: "old", status: "REVOKED" } });
    await expect(issueCard(1, db)).rejects.toBeInstanceOf(CardError);
  });
});

describe("revokeCard / regenerateCard", () => {
  it("revoca y registra motivo", async () => {
    const db = buildDb({ card: { verificationToken: "tok", status: "ISSUED" } });
    const update = vi.fn().mockResolvedValue({});
    (db as unknown as { associateCard: { update: typeof update } }).associateCard.update = update;
    await revokeCard(1, "motivo", db);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "REVOKED", revokedReason: "motivo" }) }),
    );
  });

  it("regenera con un token nuevo (el anterior deja de existir)", async () => {
    const db = buildDb({ card: { verificationToken: "old", status: "REVOKED" } });
    const update = vi.fn().mockResolvedValue({});
    (db as unknown as { associateCard: { update: typeof update } }).associateCard.update = update;
    const result = await regenerateCard(1, db);
    expect(result.status).toBe("ISSUED");
    expect(result.verificationToken).not.toBe("old");
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "ISSUED", revokedAt: null }) }),
    );
  });
});

describe("newVerificationToken", () => {
  it("genera un token aleatorio URL-safe de entropía suficiente", () => {
    const token = newVerificationToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{16,64}$/);
    expect(newVerificationToken()).not.toBe(token);
  });
});
